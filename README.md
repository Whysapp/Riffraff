# Riffraff - Music Tab Generator with AI Stem Separation

## 🎵 Frontend - Music Tab Generator (Render)
**Live URL**: https://riffraff-frontend.onrender.com
- **Client-side stem separation** using Web Audio API
- **Real-time tablature generation** from isolated instruments
- **Audio preview** of separated tracks
- **Multi-instrument support** (guitar, bass, drums, etc.)
- **Export options**: TXT, PDF, MIDI

**Deployment**:
- Deployed from `/music-tab-generator`
- Requirements: Node.js 18+
- Build: `npm install && npm run build`
- Start: `npm start`

## 🔧 Backend - Stem Separation API (Legacy)
**Live URL**: https://riffraff-stems.onrender.com
- **Server-side processing** (fallback option)
- Requirements: Python 3.10+, ffmpeg
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port 10000`

## 🚀 New Features Added
- ✅ **Client-side stem separation** - No server processing needed
- ✅ **Real-time progress tracking** during audio separation
- ✅ **Interactive UI** with stem selection (vocals, drums, bass, other)
- ✅ **Audio preview** before tablature generation
- ✅ **Enhanced accuracy** from isolated instrument tracks
- ✅ **Mobile-responsive** design for all devices