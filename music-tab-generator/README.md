# Music Tab Generator with Stem Separation

A Next.js application that converts audio files into musical tablature with local stem separation capabilities.

## Features

- 🎵 **Multi-instrument tablature generation** (Guitar, Bass, Ukulele, etc.)
- 🎤 **AI-powered stem separation** using Demucs models via Render service
- 🎛️ **Interactive stem mixer** with mute/solo/level controls
- 📊 **Audio analysis** with tempo and key detection
- 📁 **Multiple export formats** (TXT, PDF, MIDI)
- 🎨 **Modern UI** with Tailwind CSS
- 🔄 **Health monitoring** with automatic service status checks

## Quick Start

### Frontend Only (Tablature Generation)

```bash
npm install
npm run build
npm run deploy
```

### Full Setup (With Stem Separation)

The app is pre-configured to use our hosted Render service for stem separation.

1. **Deploy Frontend:**
   ```bash
   npm run deploy
   ```

2. **Configure Environment Variables in Vercel:**
   ```bash
   STEMS_SERVICE_URL=https://riffraff.onrender.com/separate
   STEMS_HEALTH_URL=https://riffraff.onrender.com/health
   STEMS_REQUEST_TIMEOUT_MS=600000
   STEMS_MAX_MB=60
   ```

## Stems Backend (Render)

The stem separation feature uses a hosted Demucs service at **https://riffraff.onrender.com**

### Service Features:
- 🚀 **Demucs htdemucs model** for high-quality 4-stem separation
- 🔄 **Automatic retries** with exponential backoff
- ⏱️ **10-minute timeout** for large files
- 📊 **Health monitoring** with real-time status
- 🛡️ **File size limits** (60MB max)

### Performance Expectations (Free Tier):
- **Small files (< 5MB):** ~30-60 seconds
- **Medium files (5-20MB):** ~1-3 minutes  
- **Large files (20-60MB):** ~3-10 minutes
- **Cold starts:** Additional 30-60 seconds

### Service Status:
The UI automatically checks service health every 60 seconds and disables the "Generate Stems" button when the service is offline.

## Deployment Options

### Vercel (Frontend)
- ✅ Automatic scaling
- ✅ Edge functions  
- ✅ Easy GitHub integration
- ✅ Environment variable management

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│  Vercel Edge     │───▶│  Render Service │
│   (Frontend)    │    │  Functions       │    │ (Demucs/FastAPI)│
│                 │    │                  │    │                 │
│ • Health Check  │    │ • Retry Logic    │    │ • htdemucs      │
│ • File Upload   │    │ • Timeout (10m)  │    │ • Health Check  │
│ • Stem Mixer    │    │ • Size Limits    │    │ • Stream Output │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Demucs, PyTorch
- **Deployment:** Vercel + Railway/Cloud Run
- **Audio:** Web Audio API, FFmpeg

## Performance

- **Tablature Generation:** ~2-5 seconds
- **Stem Separation (GPU):** ~5-30 seconds
- **Stem Separation (CPU):** ~2-10 minutes

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Open http://localhost:3000

## Production Deployment

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for detailed deployment instructions.

## QA Checklist

Before deploying, verify:

- [ ] **Environment Variables Set:** All Render service URLs configured in Vercel
- [ ] **Health Check:** Status indicator shows "Online" in the UI
- [ ] **File Upload:** Test with a ~30-50 MB audio file
- [ ] **Stem Generation:** Successfully generates and downloads stems.tar.gz
- [ ] **Stem Mixer:** Mute/Solo/Level controls work during playback
- [ ] **Error Handling:** Large files (>60MB) show appropriate error message
- [ ] **Service Offline:** UI disables button when service is down

## Deployment Instructions

### 1. Deploy to Vercel

The frontend is already deployed at: https://music-tab-generator-gt3u5w1jp-whysapps-projects.vercel.app

### 2. Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

```
STEMS_SERVICE_URL=https://riffraff.onrender.com/separate
STEMS_HEALTH_URL=https://riffraff.onrender.com/health  
STEMS_REQUEST_TIMEOUT_MS=600000
STEMS_MAX_MB=60
```

### 3. Redeploy

After adding environment variables, redeploy the frontend to apply changes.

## License

MIT License - feel free to use for personal and commercial projects.