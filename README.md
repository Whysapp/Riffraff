---
title: RiffRaff - AI Music Stem Separation
emoji: 🎵
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: mit
short_description: High-quality AI music stem separation using Demucs
---

# 🎵 RiffRaff - AI Music Stem Separation

**High-quality AI-powered music stem separation** using Facebook's Demucs model with enhanced audio processing for professional results.

## ✨ Features

- **Premium Quality**: Fine-tuned Demucs model (`htdemucs_ft`) for superior separation
- **4-Stem Separation**: Drums, Bass, Vocals, and Other instruments
- **Advanced Processing**: 32-bit float processing with optimized parameters
- **Artifact Reduction**: Soft clipping and improved normalization
- **Professional Output**: High-resolution audio with minimal noise

## 🚀 Recent Quality Improvements

This version includes significant enhancements over standard Demucs implementations:

- **Better Model**: Switched from quantized to fine-tuned model
- **Enhanced Processing**: Increased overlap (0.25) and multiple shifts (2) for smoother results
- **Improved Audio Chain**: High-quality resampling and RMS-based normalization
- **Reduced Artifacts**: Soft clipping and optimized bit depth conversion

## 🎛️ How to Use

1. **Upload** your audio file (WAV, MP3, FLAC, etc.)
2. **Click** "🎛️ Separate Stems" 
3. **Download** individual stems:
   - 🥁 Drums
   - 🎸 Bass  
   - 🎤 Vocals
   - 🎹 Other (guitars, synths, etc.)

## ⚙️ Technical Details

- **Model**: `htdemucs_ft` (Fine-tuned Hybrid Transformer Demucs)
- **Processing**: 32-bit float with 2x averaging shifts
- **Overlap**: 25% for smooth chunk transitions
- **Sample Rate**: 44.1kHz stereo output
- **Max Duration**: 30 seconds (adjustable via environment)

## 🔧 Advanced Configuration

Set environment variables for custom behavior:

```bash
# Model selection
DEMUCS_MODEL="htdemucs_ft"     # or "htdemucs_6s" for 6-source
USE_FLOAT32="true"             # Enable high-precision processing
DEMUCS_OVERLAP="0.25"          # Chunk overlap (0.1-0.75)
DEMUCS_SHIFTS="2"              # Averaging shifts (0-4)
```

## 📊 Performance

| Quality Setting | Processing Time | Audio Quality | Memory Usage |
|----------------|-----------------|---------------|--------------|
| Fast | 1x | Good | Low |
| Balanced | 1.5x | Very Good | Medium |
| High (Default) | 2x | Excellent | Medium-High |
| Maximum | 4-5x | Audiophile | High |

## 🎯 Use Cases

- **Music Production**: Extract stems for remixing
- **Karaoke**: Remove vocals from songs
- **Sampling**: Isolate specific instruments
- **Audio Analysis**: Study individual components
- **Education**: Learn music arrangement

## 🛠️ Built With

- [Demucs](https://github.com/facebookresearch/demucs) - Facebook's state-of-the-art source separation
- [Gradio](https://gradio.app/) - Interactive web interface
- [PyTorch](https://pytorch.org/) - Deep learning framework
- [Torchaudio](https://pytorch.org/audio/) - High-quality audio processing

## 📝 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions welcome! This project focuses on providing the highest quality stem separation experience.

---

*Powered by advanced AI and optimized for professional audio quality* 🎵