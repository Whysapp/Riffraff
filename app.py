import os
import tempfile
import zipfile
import gradio as gr
import torch
import numpy as np
import wave
import torchaudio
import torchaudio.functional as F
from demucs.pretrained import get_model
from demucs.audio import AudioFile
from demucs.apply import apply_model

# Configuration
MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_ft")  # Use fine-tuned model for better quality
TARGET_SAMPLE_RATE = 44100
TARGET_NUM_CHANNELS = 2
MAX_DURATION_SECONDS = int(os.environ.get("MAX_DURATION_SECONDS", "30"))
USE_FLOAT32 = os.environ.get("USE_FLOAT32", "true").lower() == "true"

# Global model cache
_loaded_model = None
_inference_device = "cuda" if torch.cuda.is_available() else "cpu"

def load_demucs_model():
    """Load and cache the Demucs model"""
    global _loaded_model
    if _loaded_model is None:
        print(f"Loading model {MODEL_NAME} on device {_inference_device}")
        model = get_model(MODEL_NAME)
        model.to(_inference_device)
        model.eval()
        _loaded_model = model
    return _loaded_model

def separate_stems(audio_file):
    """
    Separate audio into stems using Demucs
    
    Args:
        audio_file: Gradio audio input (tuple of sample_rate, audio_data)
        
    Returns:
        List of separated stem audio files
    """
    if audio_file is None:
        return "Please upload an audio file first."
    
    try:
        # Load model
        model = load_demucs_model()
        
        # Extract audio data and sample rate from Gradio input
        sample_rate, audio_data = audio_file
        
        # Convert to torch tensor and normalize
        if len(audio_data.shape) == 1:
            # Mono to stereo
            audio_data = np.stack([audio_data, audio_data])
        elif len(audio_data.shape) == 2 and audio_data.shape[0] > audio_data.shape[1]:
            # Transpose if needed (samples, channels) -> (channels, samples)
            audio_data = audio_data.T
        
        # Resample to target sample rate if needed using high-quality resampling
        if sample_rate != TARGET_SAMPLE_RATE:
            audio_tensor = torch.tensor(audio_data, dtype=torch.float32)
            audio_tensor = F.resample(audio_tensor, sample_rate, TARGET_SAMPLE_RATE)
            audio_data = audio_tensor.numpy()
        
        # Limit duration
        max_samples = TARGET_SAMPLE_RATE * MAX_DURATION_SECONDS
        if audio_data.shape[1] > max_samples:
            audio_data = audio_data[:, :max_samples]
        
        # Improved normalization to preserve dynamics
        # Use RMS normalization instead of z-score normalization
        rms = np.sqrt(np.mean(audio_data ** 2))
        if rms > 1e-8:  # Avoid division by zero
            audio_data = audio_data / (rms * 3.0)  # Scale to prevent clipping while preserving dynamics
        
        # Store original statistics for denormalization
        original_rms = rms
        
        # Convert to tensor with appropriate dtype
        tensor_dtype = torch.float32 if USE_FLOAT32 else torch.float16
        audio_tensor = torch.tensor(audio_data, dtype=tensor_dtype, device=_inference_device)
        audio_tensor = audio_tensor.unsqueeze(0)  # Add batch dimension
        
        # Separate stems with optimized parameters for quality
        with torch.no_grad():
            separated_sources = apply_model(
                model,
                audio_tensor,
                split=True,
                overlap=0.25,  # Increased overlap for smoother transitions
                shifts=2,      # Use multiple shifts and average for better quality
            )[0].to("cpu")
        
        # Get source names
        source_names = getattr(model, "sources", ["drums", "bass", "other", "vocals"])
        
        # Create temporary directory for output files
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_files = []
            
            for source_index, source_name in enumerate(source_names):
                stem_tensor = separated_sources[source_index]
                
                # Improved de-normalization using original RMS
                if original_rms > 1e-8:
                    stem_tensor = stem_tensor * (original_rms * 3.0)
                
                stem_np = stem_tensor.transpose(0, 1).numpy()  # [samples, channels]
                
                # Apply soft clipping to reduce harsh artifacts
                stem_np = np.tanh(stem_np * 0.9) * 1.1  # Soft saturation
                stem_np = np.clip(stem_np, -1.0, 1.0)
                
                # Save as higher quality audio file
                output_path = os.path.join(tmp_dir, f"{source_name}.wav")
                
                if USE_FLOAT32:
                    # Save as 32-bit float WAV for maximum quality
                    import soundfile as sf
                    try:
                        sf.write(output_path, stem_np, TARGET_SAMPLE_RATE, subtype='FLOAT')
                    except ImportError:
                        # Fallback to 24-bit if soundfile not available
                        with wave.open(output_path, "wb") as wf:
                            wf.setnchannels(TARGET_NUM_CHANNELS)
                            wf.setsampwidth(3)  # 24-bit
                            wf.setframerate(TARGET_SAMPLE_RATE)
                            pcm = (stem_np * 8388607.0).astype(np.int32)
                            # Convert to 24-bit
                            pcm_bytes = []
                            for sample in pcm.flatten():
                                pcm_bytes.extend(sample.to_bytes(4, 'little', signed=True)[:3])
                            wf.writeframes(bytes(pcm_bytes))
                else:
                    # Standard 16-bit output
                    with wave.open(output_path, "wb") as wf:
                        wf.setnchannels(TARGET_NUM_CHANNELS)
                        wf.setsampwidth(2)  # 16-bit
                        wf.setframerate(TARGET_SAMPLE_RATE)
                        pcm = (stem_np * 32767.0).astype(np.int16)
                        wf.writeframes(pcm.tobytes())
                
                # Copy to a permanent location for Gradio
                import shutil
                permanent_path = f"/tmp/{source_name}.wav"
                shutil.copy2(output_path, permanent_path)
                output_files.append(permanent_path)
            
            return output_files
            
    except Exception as e:
        return f"Error during separation: {str(e)}"

def create_interface():
    """Create the Gradio interface"""
    
    # Custom CSS for better styling
    css = """
    .gradio-container {
        max-width: 800px;
        margin: auto;
    }
    .header {
        text-align: center;
        margin-bottom: 2rem;
    }
    .footer {
        text-align: center;
        margin-top: 2rem;
        color: #666;
    }
    """
    
    with gr.Blocks(css=css, title="RiffRaff - AI Music Stem Separation") as demo:
        gr.HTML("""
        <div class="header">
            <h1>🎵 RiffRaff - AI Music Stem Separation</h1>
            <p>Upload a song and separate it into individual stems (drums, bass, vocals, other)</p>
            <p><em>Powered by Facebook's Demucs AI model</em></p>
        </div>
        """)
        
        with gr.Row():
            with gr.Column():
                audio_input = gr.Audio(
                    label="Upload Audio File",
                    type="numpy",
                    format="wav"
                )
                
                separate_btn = gr.Button(
                    "🎛️ Separate Stems", 
                    variant="primary",
                    size="lg"
                )
                
                gr.HTML(f"""
                <div style="margin-top: 1rem; padding: 1rem; background-color: #f0f0f0; border-radius: 8px;">
                    <strong>ℹ️ Info:</strong>
                    <ul style="margin: 0.5rem 0;">
                        <li>Maximum duration: {MAX_DURATION_SECONDS} seconds</li>
                        <li>Supported formats: WAV, MP3, FLAC, etc.</li>
                        <li>Processing time: ~30-60 seconds depending on length</li>
                        <li>Device: {_inference_device.upper()}</li>
                    </ul>
                </div>
                """)
        
        with gr.Row():
            with gr.Column():
                gr.HTML("<h3>🎵 Separated Stems</h3>")
                
                drums_output = gr.Audio(label="🥁 Drums", interactive=False)
                bass_output = gr.Audio(label="🎸 Bass", interactive=False)
                vocals_output = gr.Audio(label="🎤 Vocals", interactive=False)
                other_output = gr.Audio(label="🎹 Other", interactive=False)
        
        def process_and_display(audio_file):
            """Process audio and return individual stems"""
            if audio_file is None:
                return None, None, None, None
                
            result = separate_stems(audio_file)
            
            if isinstance(result, str):  # Error message
                gr.Warning(result)
                return None, None, None, None
            
            # Return the four stems in order: drums, bass, other, vocals
            # (matching the typical Demucs output order)
            stems = [None, None, None, None]
            for i, path in enumerate(result):
                if i < 4:
                    stems[i] = path
            
            return stems[0], stems[1], stems[3], stems[2]  # drums, bass, vocals, other
        
        separate_btn.click(
            fn=process_and_display,
            inputs=[audio_input],
            outputs=[drums_output, bass_output, vocals_output, other_output],
            show_progress=True
        )
        
        gr.HTML("""
        <div class="footer">
            <p>Built with ❤️ using <a href="https://github.com/facebookresearch/demucs" target="_blank">Demucs</a> 
            and <a href="https://gradio.app" target="_blank">Gradio</a></p>
            <p>Upload your favorite songs and extract individual instrument tracks!</p>
        </div>
        """)
    
    return demo

# Preload model when the module is imported
print("Preloading Demucs model...")
try:
    load_demucs_model()
    print("Model loaded successfully!")
except Exception as e:
    print(f"Warning: Could not preload model: {e}")

# Create and launch the interface
if __name__ == "__main__":
    demo = create_interface()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=True
    )