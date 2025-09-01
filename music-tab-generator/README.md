# TabCraft Pro - Music to Tablature Web App

Transform songs into tablature for guitar, bass, ukulele, banjo, mandolin, and more. Upload audio/video or paste a YouTube URL, then analyze on-device using the Web Audio API. Export as TXT/PDF/MIDI.

Live: https://music-tab-generator-ke8r1qi5c-whysapps-projects.vercel.app

## Features
- Multi-instrument support with tunings and fret ranges
- Client-side analysis (offline-capable):
  - Pitch detection (autocorrelation)
  - Tempo/key estimation
  - Waveform visualization
  - Worker-based processing for smooth UI
- YouTube audio proxy (server API)
- Export: TXT, PDF, MIDI
- Processing settings: frequency range, sensitivity
- Toast notifications for status/errors

## Tech Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Web Audio API
- ytdl-core (server) for YouTube extraction
- lucide-react icons, sonner toasts

## Getting Started

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Scripts
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm start` - start production server

## API Endpoints
- `POST /api/upload-audio` - multipart form upload, returns temporary ID
- `POST /api/youtube-extract` - returns direct audio URL (fallback)
- `POST /api/ytdl` - streams audio from YouTube to the client
- `POST /api/process-audio` - stubbed server processing
- `GET /api/instruments` - instrument configs

## Architecture
- `src/components/MusicTabGenerator.tsx` - main UI
- `src/workers/audioWorker.ts` - pitch/tempo/key + chord hints in a Web Worker with progress
- `src/lib/audio.ts` - audio utilities (decode, analysis, tab conversion, waveform, chord detection)
- `src/lib/instruments.ts` - instrument registry

## Notes & Limitations
- Polyphonic accuracy is limited; optimized for single instrument lines
- YouTube proxy is intended for demo usage; consider caching and rate limits
- PDF/MIDI exports are basic; customize as needed

## Roadmap
- Improve chord recognition and polyphonic handling
- Optional server-side DSP for heavy workloads
- Add SSE/WebSocket for long-running tasks