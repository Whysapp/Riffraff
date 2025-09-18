# HuggingFace Integration Guide

This document describes the integration of HuggingFace Spaces APIs for stem separation and guitar tablature generation.

## Overview

We have replaced the previous local processing approach with two HuggingFace Spaces:

1. **Stem Separation**: [Spleeter-HT-Demucs-Stem-Separation-2025](https://huggingface.co/spaces/ahk-d/Spleeter-HT-Demucs-Stem-Separation-2025)
2. **Guitar Tablature**: [guitar-tabs-ai](https://huggingface.co/spaces/JonathanJH/guitar-tabs-ai)

## Architecture

### Direct API Calls
The frontend first attempts to call the HuggingFace Spaces APIs directly:
- Stem Separation: `https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/api/predict`
- Guitar Tabs: `https://jonathanjh-guitar-tabs-ai.hf.space/api/predict`

### Proxy Service Fallback
If direct calls fail, the system falls back to a Python proxy service (`hf-api-proxy`) that uses the `gradio_client` library for more robust API interactions.

### Fallback Processing
If both HuggingFace approaches fail, the system uses the original local processing methods.

## Components

### Frontend Changes
- **`/src/lib/huggingfaceClient.ts`**: Client functions for HuggingFace APIs
- **`/src/components/MusicTabGenerator.tsx`**: Updated UI with stem separation and improved tablature generation
- **`/src/app/api/stems/separate/route.ts`**: Updated stem separation endpoint
- **`/src/app/api/process-audio/route.ts`**: Updated tablature generation endpoint

### Backend Proxy Service
- **`/hf-api-proxy/app.py`**: FastAPI service for HuggingFace API calls
- **`/hf-api-proxy/requirements.txt`**: Python dependencies
- **`/hf-api-proxy/start.sh`**: Startup script

## Features

### Stem Separation
- Separates audio into 4 stems: drums, bass, other, vocals
- Uses HT-Demucs and Spleeter models for high-quality separation
- Provides individual audio files for each stem
- Download capability for each separated stem

### Guitar Tablature Generation
- AI-powered tablature generation from audio
- Supports multiple instruments (guitar, bass, ukulele, etc.)
- Provides tempo and key detection
- Export options (TXT, PDF, MIDI)

## Environment Variables

### Next.js Frontend
```env
HF_PROXY_URL=http://localhost:8001  # URL for the HuggingFace proxy service
```

### HuggingFace Proxy Service
```env
PORT=8001  # Port for the proxy service
```

## Deployment

### HuggingFace Proxy Service
1. Navigate to the `hf-api-proxy` directory
2. Install dependencies: `pip install -r requirements.txt`
3. Start the service: `./start.sh` or `uvicorn app:app --host 0.0.0.0 --port 8001`

### Next.js Frontend
1. Set the `HF_PROXY_URL` environment variable if using a remote proxy
2. Start the development server: `npm run dev`
3. Or build for production: `npm run build && npm start`

## API Endpoints

### Stem Separation
**POST** `/api/stems/separate`
- Body: FormData with `file` (audio file)
- Response: JSON with separated stems URLs

### Tablature Generation
**POST** `/api/process-audio`
- Body: FormData with `file` (audio file) and `instrumentKey` (string)
- Response: JSON with tablature lines, BPM, and key

## Error Handling

The system implements a multi-tier fallback approach:
1. Direct HuggingFace Spaces API calls
2. Proxy service using gradio_client
3. Local processing methods (for tablature)

This ensures maximum reliability and uptime.

## UI Improvements

### New Features
- **Stem Separation Button**: Separate audio into individual instruments
- **Stem Playback**: Listen to individual stems with audio controls
- **Download Stems**: Download individual stem files
- **Processing Status**: Clear feedback on which AI service is being used
- **Improved Error Messages**: Better error handling and user feedback

### Enhanced User Experience
- Toast notifications with service source information
- Disabled states during processing
- Progress indicators for long-running operations
- Responsive design for mobile devices

## Testing

To test the integration:

1. **Start the proxy service** (optional, for fallback):
   ```bash
   cd hf-api-proxy
   ./start.sh
   ```

2. **Start the Next.js application**:
   ```bash
   cd music-tab-generator
   npm run dev
   ```

3. **Upload an audio file** and test both features:
   - Click "Generate Tablature" to test tablature generation
   - Click "Separate Stems" to test stem separation

## Troubleshooting

### Common Issues

1. **HuggingFace Spaces Unavailable**
   - The system will automatically fall back to the proxy service
   - Check the browser console for detailed error messages

2. **Proxy Service Connection Failed**
   - Ensure the proxy service is running on the correct port
   - Check the `HF_PROXY_URL` environment variable

3. **gradio_client Import Error**
   - Install the gradio_client library: `pip install gradio_client`
   - Check Python version compatibility

### Monitoring

Monitor the application logs for:
- API response times
- Fallback usage patterns
- Error rates from different services

## Future Improvements

1. **Caching**: Implement caching for HuggingFace API responses
2. **Rate Limiting**: Add rate limiting for API calls
3. **Authentication**: Add API keys for HuggingFace Spaces if required
4. **Performance**: Optimize file upload and processing workflows
5. **Analytics**: Track usage patterns and service reliability