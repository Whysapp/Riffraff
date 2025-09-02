# Stem Separation Feature

This document describes how to set up and use the local stem separation feature with Demucs.

## Overview

The stem separation feature allows you to:
- Generate vocal, drum, bass, and other stems from uploaded audio files
- Mix and control individual stems with mute/solo/level controls
- Play stems in sync through the web audio API
- Keep all processing local (no third-party APIs)

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python/stems
pip install -r requirements.txt
```

For GPU acceleration (recommended):
```bash
# Install CUDA-enabled PyTorch (adjust for your CUDA version)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 2. Start the Python Microservice

```bash
cd python/stems
uvicorn app:app --host 0.0.0.0 --port 8001
```

The service will be available at `http://localhost:8001`

### 3. Start the Next.js Application

```bash
# From the root directory
npm run dev
```

The web app will be available at `http://localhost:3000`

## Using Docker (GPU Support)

For GPU acceleration with Docker:

```bash
cd python/stems
docker build -t stems-service .
docker run --gpus all -p 8001:8001 stems-service
```

## Usage

1. Upload an audio file (MP3, WAV, FLAC, etc.)
2. Click "Generate Stems" - this will take 30 seconds to several minutes depending on:
   - Audio length
   - Whether you have GPU acceleration
   - Model complexity
3. Once stems are generated, use the Stem Mixer to:
   - Play/Stop all stems in sync
   - Mute individual stems
   - Solo specific stems
   - Adjust volume levels (0-200%)

## Performance Notes

- **GPU**: ~5-30 seconds for a 3-4 minute song
- **CPU**: ~2-10 minutes for a 3-4 minute song
- The default model `htdemucs` provides good quality 4-stem separation
- Stems are cached in browser memory for instant replay

## Troubleshooting

- If stems service is not responding, check that it's running on port 8001
- For CUDA issues, ensure you have compatible PyTorch and CUDA versions
- Large audio files may cause memory issues - try shorter clips first
- Check browser console for detailed error messages

## Future Enhancements

- Model selection (different Demucs models)
- 6-stem separation (adding guitar/piano)
- Stem export functionality
- IndexedDB persistence across sessions
- Browser-only processing with ONNX models