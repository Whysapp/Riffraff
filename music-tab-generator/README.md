# Music Tab Generator with Stem Separation

A Next.js application that converts audio files into musical tablature with local stem separation capabilities.

## Features

- 🎵 **Multi-instrument tablature generation** (Guitar, Bass, Ukulele, etc.)
- 🎤 **Local stem separation** using Demucs AI models
- 🎛️ **Interactive stem mixer** with mute/solo/level controls
- 📊 **Audio analysis** with tempo and key detection
- 📁 **Multiple export formats** (TXT, PDF, MIDI)
- 🎨 **Modern UI** with Tailwind CSS

## Quick Start

### Frontend Only (Tablature Generation)

```bash
npm install
npm run build
npm run deploy
```

### Full Setup (With Stem Separation)

1. **Deploy Python Service:**
   ```bash
   cd python/stems
   pip install -r requirements.txt
   uvicorn app:app --host 0.0.0.0 --port 8001
   ```

2. **Deploy Frontend:**
   ```bash
   npm run deploy
   ```

3. **Configure Environment:**
   Set `STEMS_SERVICE_URL` to your Python service URL

## Deployment Options

### Vercel (Frontend)
- ✅ Automatic scaling
- ✅ Edge functions
- ✅ Easy GitHub integration

### Railway (Python Service)
- ✅ GPU support
- ✅ Docker deployment
- ✅ Automatic HTTPS

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│  Vercel Edge     │───▶│  Python Service │
│   (Frontend)    │    │  Functions       │    │  (Demucs AI)    │
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

## License

MIT License - feel free to use for personal and commercial projects.