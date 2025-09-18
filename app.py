import os
import tempfile
import zipfile
import gradio as gr
import torch
import numpy as np
import wave
from demucs.pretrained import get_model
from demucs.audio import AudioFile
from demucs.apply import apply_model

# Configuration
MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_quantized")
TARGET_SAMPLE_RATE = 44100
TARGET_NUM_CHANNELS = 2
MAX_DURATION_SECONDS = int(os.environ.get("MAX_DURATION_SECONDS", "30"))

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
        
        # Resample to target sample rate if needed
        if sample_rate != TARGET_SAMPLE_RATE:
            # Simple resampling - in production you'd want proper resampling
            ratio = TARGET_SAMPLE_RATE / sample_rate
            new_length = int(audio_data.shape[1] * ratio)
            audio_data = np.array([np.interp(np.linspace(0, len(channel), new_length), 
                                           np.arange(len(channel)), channel) 
                                 for channel in audio_data])
        
        # Limit duration
        max_samples = TARGET_SAMPLE_RATE * MAX_DURATION_SECONDS
        if audio_data.shape[1] > max_samples:
            audio_data = audio_data[:, :max_samples]
        
        # Normalize audio
        reference_channel = audio_data.mean(0)
        audio_data = (audio_data - reference_channel.mean()) / (reference_channel.std() + 1e-8)
        
        # Convert to tensor
        audio_tensor = torch.tensor(audio_data, dtype=torch.float32, device=_inference_device)
        audio_tensor = audio_tensor.unsqueeze(0)  # Add batch dimension
        
        # Separate stems
        with torch.no_grad():
            separated_sources = apply_model(
                model,
                audio_tensor,
                split=True,
                overlap=0.10,
                shifts=0,
            )[0].to("cpu")
        
        # Get source names
        source_names = getattr(model, "sources", ["drums", "bass", "other", "vocals"])
        
        # Create temporary directory for output files
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_files = []
            
            for source_index, source_name in enumerate(source_names):
                stem_tensor = separated_sources[source_index]
                
                # De-normalize
                stem_tensor = stem_tensor * (reference_channel.std() + 1e-8) + reference_channel.mean()
                stem_np = stem_tensor.transpose(0, 1).numpy()  # [samples, channels]
                
                # Clip and convert to int16
                stem_np = np.clip(stem_np, -1.0, 1.0)
                
                # Save as audio file that Gradio can handle
                output_path = os.path.join(tmp_dir, f"{source_name}.wav")
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