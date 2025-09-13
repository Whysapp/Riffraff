# Riffraff - Music Tab Generator with AI Stem Separation

Transform songs into tablature with AI-powered instrument isolation. Upload audio files, separate individual instruments using client-side processing, and generate highly accurate tablature for guitar, bass, drums, and more.

**🎵 Live Demo**: https://riffraff-frontend.onrender.com

## 🚀 New Features - AI Stem Separation

### ✨ Client-Side Instrument Isolation
- **🎤 Vocals Isolation** - Extract vocal melodies with center channel processing
- **🥁 Drums Isolation** - Isolate percussion using onset detection algorithms  
- **🎸 Bass Isolation** - Extract bass lines with low-frequency filtering
- **🎹 Other Instruments** - Isolate everything else (piano, guitar, synths)

### 🎯 Enhanced Accuracy
- **Dramatically improved tablature accuracy** from isolated instrument tracks
- **Real-time audio preview** of separated stems before processing
- **Interactive progress tracking** during separation
- **Smart frequency analysis** optimized for each instrument type

### 💻 100% Browser-Based
- **No server processing** - all separation runs in your browser
- **Privacy-first** - audio never leaves your device
- **Works offline** after initial page load
- **Real-time processing** with Web Audio API

## 🎵 Supported Instruments

### String Instruments
- **Guitar** (6-string, 7-string) - Standard, Drop D, DADGAD, Open tunings
- **Bass** (4-string, 5-string) - Standard and alternate tunings
- **Ukulele** - Soprano, Concert, Tenor tunings
- **Banjo** - 5-string, 4-string configurations
- **Mandolin** - Traditional GDAE tuning

### Percussion
- **Drums** - Full kit transcription with kick, snare, hi-hat detection
- **Percussion** - Tambourine, shaker, conga patterns

## 🔧 How It Works

1. **Upload Audio** - Support for MP3, WAV, FLAC, M4A, AAC, OGG (up to 50MB)
2. **Enable Stem Separation** - Choose target instrument to isolate
3. **AI Processing** - Real-time separation using Web Audio API algorithms
4. **Preview Results** - Listen to isolated instrument before generating tabs
5. **Generate Tablature** - Create accurate tabs from clean, separated audio
6. **Export Options** - Download as TXT, PDF, or MIDI files

## 🛠️ Technical Stack

### Frontend
- **Next.js 14** (App Router) with TypeScript
- **Tailwind CSS** for responsive design
- **Web Audio API** for client-side audio processing
- **Lucide React** icons and **Sonner** toast notifications

### Audio Processing
- **Custom stem separation algorithms** for instrument isolation
- **Pitch detection** using autocorrelation
- **Onset detection** for percussion analysis
- **Harmonic enhancement** for better separation quality
- **Real-time progress tracking** with worker-based processing

### Export Capabilities
- **TXT Export** - Plain text tablature format
- **PDF Export** - Formatted tablature documents using jsPDF
- **MIDI Export** - Compatible with music software using Tone.js

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
```

### Deployment
- **Vercel**: Automatic deployment from root directory
- **Render**: Configured with render.yaml
- **Any Node.js host**: Standard Next.js deployment

## 📁 Project Structure

```
/workspace
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API endpoints
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/            # React components
│   │   ├── MusicTabGenerator.tsx  # Main interface with stem separation
│   │   ├── PlayerControls.tsx     # Audio playback controls
│   │   ├── AdvancedSettings.tsx   # Processing configuration
│   │   └── Waveform.tsx          # Audio visualization
│   ├── lib/                   # Core libraries
│   │   ├── clientStemSeparator.ts # AI stem separation engine
│   │   ├── audioProcessor.ts      # Audio analysis
│   │   ├── tablatureGenerator.ts  # Tab generation
│   │   └── instruments.ts         # Instrument configurations
│   └── workers/               # Web Workers
│       └── audioWorker.ts     # Background audio processing
├── backend-stems/             # Legacy Python API (optional)
└── render.yaml               # Deployment configuration
```

## 🎯 API Endpoints

- `GET /api/instruments` - Get instrument configurations
- `POST /api/upload-audio` - Handle audio file uploads
- `POST /api/process-audio` - Server-side processing (fallback)

## 🌟 Key Algorithms

### Stem Separation
- **Center Channel Extraction** - Isolate vocals using L/R channel differences
- **Percussive Enhancement** - Detect and amplify drum hits using onset analysis
- **Frequency Domain Filtering** - Isolate bass using low-pass filters
- **Harmonic Subtraction** - Extract "other" instruments by removing known stems

### Tablature Generation
- **Pitch Detection** - Autocorrelation-based fundamental frequency estimation
- **Note Quantization** - Smart rounding to musical notes and frets
- **Rhythm Analysis** - Tempo detection and beat alignment
- **Chord Recognition** - Multi-note chord detection and fingering suggestions

## 📊 Performance

- **Build Time**: ~30-60 seconds
- **First Load JS**: ~109 KB
- **Audio Processing**: Real-time in browser
- **File Size Limit**: 50 MB
- **Browser Support**: Chrome, Firefox, Safari, Edge

## 🧪 Testing Checklist

### Core Functionality
- [ ] Upload various audio formats (MP3, WAV, FLAC)
- [ ] Enable stem separation and select instruments
- [ ] Watch real-time progress during separation
- [ ] Preview separated audio tracks
- [ ] Generate accurate tablature
- [ ] Export as TXT, PDF, and MIDI

### Browser Compatibility
- [ ] Chrome/Edge (optimal performance)
- [ ] Firefox (full compatibility)
- [ ] Safari/iOS (with user gesture for audio)
- [ ] Mobile browsers (responsive design)

## 🎵 Example Use Cases

### Musicians
- **Learn Songs Faster** - Isolate your instrument from complex mixes
- **Practice Along** - Generate backing tracks by removing your part
- **Transcribe Accurately** - Get clean tablature from isolated instruments

### Music Teachers
- **Create Exercises** - Generate practice materials from any song
- **Demonstrate Techniques** - Show isolated instrument parts to students
- **Analyze Compositions** - Break down complex arrangements

### Content Creators
- **Remix Projects** - Extract individual instruments for remixing
- **Cover Versions** - Learn exact parts from original recordings
- **Educational Content** - Create tutorials with isolated tracks

## 🔧 Troubleshooting

### Audio Issues
- Ensure HTTPS deployment (required for Web Audio API)
- Check browser console for Web Audio errors
- Verify user interaction before audio playback

### Build Issues
```bash
# Clean rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Performance Tips
- Use shorter audio clips for faster processing
- Enable stem separation only when needed for better accuracy
- Close other browser tabs during heavy processing

## 🛣️ Roadmap

- [ ] **Advanced ML Models** - TensorFlow.js integration for better separation
- [ ] **Cloud Processing** - Optional server-side processing for complex tracks  
- [ ] **Batch Processing** - Handle multiple files simultaneously
- [ ] **Custom Tunings** - User-defined instrument configurations
- [ ] **Collaboration Features** - Share and collaborate on tablature projects

## 📞 Support

- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: Comprehensive guides in `/docs`
- **Community**: Join discussions in GitHub Discussions

---

**🎵 Transform any song into perfect tablature with AI-powered stem separation! 🚀**