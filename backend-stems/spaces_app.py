"""
Gradio app for Hugging Face Spaces deployment.
Provides a simple web interface for guitar stem separation and tablature generation.
"""
import gradio as gr
import tempfile
import zipfile
from pathlib import Path
import soundfile as sf
import os

from separators.demucs_sep import DemucsSeparator
from music_tab_generator import generate_tabs_for_file

# Initialize separator
sep = DemucsSeparator(sr=44100)

def process_audio(audio_file):
    """
    Process uploaded audio file and return guitar stem, others stem, and tablature.
    """
    if audio_file is None:
        return None, None, "Please upload an audio file first."
    
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Get input file path
            input_path = audio_file  # Gradio provides the file path directly
            
            # Run separation
            out = sep.separate_from_path(
                input_path, 
                segment=int(os.getenv("SEGMENT_SEC", "60")),
                overlap=float(os.getenv("OVERLAP", "0.1")),
                shifts=int(os.getenv("SHIFTS", "0"))
            )
            
            # Write stems - arrays are [channels, samples]
            guitar_path = Path(tmp_dir) / "guitar.wav"
            others_path = Path(tmp_dir) / "others.wav"
            sf.write(str(guitar_path), out["guitar"].T, 44100, subtype="PCM_16")
            sf.write(str(others_path), out["others"].T, 44100, subtype="PCM_16")
            
            # Generate tablature HTML
            try:
                tabs_html = Path(tmp_dir) / "tabs.html"
                generate_tabs_for_file(str(guitar_path), str(tabs_html))
                tabs_content = tabs_html.read_text(encoding='utf-8')
            except Exception as e:
                tabs_content = f"""
                <html><body>
                <h3>🎸 Tablature Generation</h3>
                <p style="color: orange;">Could not generate tablature: {str(e)}</p>
                <p>The guitar stem has been extracted successfully. You can download it and use external tools for tablature generation.</p>
                </body></html>
                """
            
            # Copy files to permanent locations for Gradio to serve
            import shutil
            guitar_output = str(guitar_path) + "_output.wav"
            others_output = str(others_path) + "_output.wav"
            shutil.copy(guitar_path, guitar_output)
            shutil.copy(others_path, others_output)
            
            return guitar_output, others_output, tabs_content
            
    except Exception as e:
        error_msg = f"""
        <html><body>
        <h3>❌ Processing Error</h3>
        <p style="color: red;">Failed to process audio: {str(e)}</p>
        <p>Please try with a different audio file or check the file format.</p>
        </body></html>
        """
        return None, None, error_msg

# Create Gradio interface
def create_interface():
    with gr.Blocks(
        title="🎸 Riffraff - Guitar Stem Separation & Tablature Generator",
        theme=gr.themes.Soft()
    ) as demo:
        gr.Markdown("""
        # 🎸 Riffraff - Guitar Stem Separation & Tablature Generator
        
        Upload any song and get:
        - **Guitar stem** - isolated guitar track
        - **Others stem** - everything except guitar  
        - **Auto-generated tablature** - guitar tabs from the isolated track
        
        *Powered by Demucs AI and running on Hugging Face Spaces*
        """)
        
        with gr.Row():
            with gr.Column():
                audio_input = gr.Audio(
                    label="🎵 Upload Audio File",
                    type="filepath",
                    format="wav"
                )
                
                process_btn = gr.Button(
                    "🚀 Separate Guitar & Generate Tabs",
                    variant="primary",
                    size="lg"
                )
                
                gr.Markdown("""
                **Supported formats:** MP3, WAV, FLAC, M4A  
                **Processing time:** ~30-60 seconds depending on song length  
                **Best results:** Songs with prominent guitar parts
                """)
            
            with gr.Column():
                guitar_output = gr.Audio(
                    label="🎸 Guitar Stem",
                    type="filepath"
                )
                
                others_output = gr.Audio(
                    label="🎵 Others (No Guitar)",
                    type="filepath"
                )
        
        with gr.Row():
            tabs_output = gr.HTML(
                label="📝 Generated Tablature",
                value="<p>Upload audio and click 'Separate Guitar & Generate Tabs' to see tablature here.</p>"
            )
        
        # Event handling
        process_btn.click(
            fn=process_audio,
            inputs=[audio_input],
            outputs=[guitar_output, others_output, tabs_output],
            show_progress=True
        )
        
        # Example files section
        gr.Markdown("""
        ---
        ### 💡 Tips for Best Results:
        - Use songs with clear, prominent guitar parts
        - Avoid heavily distorted or heavily processed audio
        - Shorter songs (< 5 minutes) process faster
        - The tablature is auto-generated and may need manual correction
        
        ### 🔧 Technical Details:
        - **Model:** Demucs (htdemucs or htdemucs_6s if available)
        - **Sample Rate:** 44.1kHz
        - **Output Format:** 16-bit WAV
        - **Tablature:** Basic pitch-to-fret mapping with HTML output
        """)
    
    return demo

# Launch the app
if __name__ == "__main__":
    demo = create_interface()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,  # Standard port for HF Spaces
        share=False
    )