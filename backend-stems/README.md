# Riffraff Backend - Demucs Guitar Separation & Tablature Generator

This is the backend component of Riffraff that provides guitar stem separation using Demucs and automatic tablature generation.

## Features

- **Guitar Stem Isolation**: Uses Demucs AI to separate guitar from other instruments
- **Tablature Generation**: Automatically generates guitar tabs from isolated stems
- **FastAPI Backend**: RESTful API for programmatic access
- **Gradio Interface**: Web UI for Hugging Face Spaces deployment
- **ZIP Output**: Returns guitar.wav, others.wav, and tabs.html in a single download

## Architecture

```
backend-stems/
├── app.py                  # FastAPI server
├── spaces_app.py          # Gradio app for HF Spaces
├── separators/
│   ├── demucs_sep.py      # DemucsSeparator class
│   └── __init__.py
├── music_tab_generator/
│   └── __init__.py        # Tab generation wrapper
├── tests/
│   ├── test_separate.py   # Unit tests
│   └── __init__.py
├── requirements.txt       # Dependencies
└── README.md             # This file
```

## Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   cd backend-stems
   pip install -r requirements.txt
   ```

2. **Run FastAPI Server**
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 10000
   ```

3. **Test Separation**
   ```bash
   curl -F "file=@song.mp3" "http://localhost:10000/separate" -o output.zip
   ```

4. **Run Gradio Interface** (optional)
   ```bash
   python spaces_app.py
   ```

### Environment Variables

- `DEMUCS_MODEL`: Model name (default: "htdemucs", options: "htdemucs", "htdemucs_6s")
- `SEGMENT_SEC`: Audio segment size in seconds (default: "60")
- `OVERLAP`: Overlap ratio for segments (default: "0.1") 
- `SHIFTS`: Number of random shifts for ensemble (default: "0")

## Deploy to Hugging Face Spaces

### Step 1: Create New Space

1. Go to [Hugging Face Spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Choose:
   - **Space name**: `your-username/riffraff-guitar-separation`
   - **License**: Apache 2.0 (or your preference)
   - **Space SDK**: Gradio
   - **Space hardware**: GPU Basic (recommended) or CPU Basic
   - **Visibility**: Public

### Step 2: Configure Space

1. **Upload Files**: Copy these files to your Space repository:
   ```
   app.py → spaces_app.py (rename for clarity)
   separators/
   music_tab_generator/
   requirements.txt
   ```

2. **Set Environment Variables** (in Space settings):
   ```
   DEMUCS_MODEL=htdemucs_6s  # Use 6-source model if available
   SEGMENT_SEC=60
   OVERLAP=0.1
   SHIFTS=0
   ```

3. **Create Space Files**:

   **`app.py`** (main entry point):
   ```python
   from spaces_app import create_interface
   
   if __name__ == "__main__":
       demo = create_interface()
       demo.launch()
   ```

   **`requirements.txt`** (copy from backend-stems/requirements.txt):
   ```
   torch
   torchaudio
   demucs==4.0.0
   numpy
   soundfile
   librosa
   gradio
   ```

### Step 3: Deploy

1. **Push to Space**:
   ```bash
   git clone https://huggingface.co/spaces/your-username/riffraff-guitar-separation
   cd riffraff-guitar-separation
   
   # Copy files
   cp -r backend-stems/separators .
   cp -r backend-stems/music_tab_generator .
   cp backend-stems/spaces_app.py app.py
   cp backend-stems/requirements.txt .
   
   # Commit and push
   git add .
   git commit -m "Add Riffraff guitar separation and tablature generation"
   git push
   ```

2. **Monitor Build**: Check the Space logs for any build errors

3. **Test Deployment**: Upload a test audio file and verify:
   - Guitar stem separation works
   - Tablature generation completes
   - Audio playback functions correctly

### Step 4: GPU Optimization

For better performance on GPU instances:

1. **Environment Variables**:
   ```
   DEMUCS_MODEL=htdemucs_6s  # 6-source model for better guitar separation
   SEGMENT_SEC=120           # Larger segments on GPU
   SHIFTS=1                  # Enable ensemble for better quality
   ```

2. **Hardware Selection**:
   - **GPU Basic**: Good for demos, moderate queue times
   - **GPU Standard**: Faster processing, shorter queues
   - **CPU Basic**: Slower but always available (fallback)

## API Reference

### POST /separate

Separate guitar from other instruments and generate tablature.

**Parameters:**
- `file`: Audio file (multipart/form-data)
- `sr`: Sample rate (optional, default: 44100)

**Response:**
- ZIP file containing:
  - `guitar.wav`: Isolated guitar stem
  - `others.wav`: Everything except guitar
  - `tabs.html`: Generated tablature

**Example:**
```bash
curl -X POST \
  -F "file=@song.mp3" \
  -F "sr=44100" \
  "https://your-space.hf.space/separate" \
  -o result.zip
```

### GET /health

Check service status and model information.

**Response:**
```json
{
  "status": "ok",
  "device": "cuda",
  "model": "htdemucs_6s"
}
```

## Testing

Run the test suite:

```bash
cd backend-stems
python -m pytest tests/ -v
```

**Test Coverage:**
- DemucsSeparator initialization and loading
- Audio separation with synthetic data
- Tablature generation from audio
- Error handling and edge cases
- Full pipeline integration

## Performance Notes

### Model Selection

- **htdemucs**: 4-source model (drums, bass, other, vocals)
  - Guitar extracted from "other" using spectral heuristics
  - Faster processing, lower memory usage
  
- **htdemucs_6s**: 6-source model (drums, bass, other, vocals, guitar, piano)
  - Direct guitar separation when available
  - Better quality but slower processing

### Processing Times

| Audio Length | CPU (htdemucs) | GPU (htdemucs) | GPU (htdemucs_6s) |
|-------------|----------------|----------------|-------------------|
| 3 minutes   | ~2-3 minutes   | ~30-45 seconds | ~45-60 seconds    |
| 5 minutes   | ~4-6 minutes   | ~50-75 seconds | ~75-90 seconds    |

### Memory Requirements

- **CPU**: 4-8GB RAM recommended
- **GPU**: 6-8GB VRAM for htdemucs, 8-12GB for htdemucs_6s

## Troubleshooting

### Common Issues

1. **Model Download Fails**
   ```
   Error: Could not download model
   ```
   - **Solution**: Check internet connection, try different model name
   - **Fallback**: Set `DEMUCS_MODEL=htdemucs` (smaller, more reliable)

2. **CUDA Out of Memory**
   ```
   RuntimeError: CUDA out of memory
   ```
   - **Solution**: Reduce `SEGMENT_SEC` to 30 or 45
   - **Alternative**: Use CPU processing (slower but works)

3. **Tablature Generation Fails**
   ```
   Could not run music-tab-generator
   ```
   - **Expected**: Falls back to placeholder HTML with download link
   - **Note**: Tab generation is best-effort, guitar stem always works

4. **Slow Processing on HF Spaces**
   - **Cause**: CPU instance or queue wait times
   - **Solution**: Upgrade to GPU Basic or GPU Standard

### Debug Mode

Enable verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Contributing

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/riffraff.git
   cd riffraff/backend-stems
   ```

2. **Install Dev Dependencies**
   ```bash
   pip install -r requirements.txt
   pip install pytest black flake8
   ```

3. **Run Tests**
   ```bash
   pytest tests/ -v
   black . --check
   flake8 .
   ```

4. **Submit PR** with test coverage for new features

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Acknowledgments

- [Demucs](https://github.com/facebookresearch/demucs) for state-of-the-art source separation
- [Hugging Face Spaces](https://huggingface.co/spaces) for GPU-enabled deployment
- [Gradio](https://gradio.app/) for the web interface
- [Librosa](https://librosa.org/) for audio analysis

---

**🎸 Transform any song into guitar tabs with AI-powered stem separation! 🚀**