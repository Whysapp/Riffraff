# Demucs Audio Quality Improvements

This document outlines the improvements made to reduce noisy/grainy output from your Demucs integration and provides guidance on fine-tuning for optimal audio quality.

## Issues Addressed

### 1. **Model Selection**
- **Problem**: Using `htdemucs_quantized` (compressed model) sacrificed quality for speed
- **Solution**: Switched to `htdemucs_ft` (fine-tuned model) for significantly better separation quality

### 2. **Poor Audio Resampling**
- **Problem**: Basic numpy interpolation for resampling introduced artifacts
- **Solution**: Implemented high-quality resampling using `torchaudio.functional.resample`

### 3. **Suboptimal Processing Parameters**
- **Problem**: Minimal overlap (0.10) and no shifts created discontinuities and artifacts
- **Solution**: Increased overlap to 0.25 and added 2 shifts with averaging for smoother results

### 4. **Aggressive Normalization**
- **Problem**: Z-score normalization could introduce artifacts and alter dynamics
- **Solution**: Implemented RMS-based normalization that preserves original dynamics

### 5. **Quantization Noise**
- **Problem**: Direct conversion to 16-bit integer introduced quantization noise
- **Solution**: Added soft clipping and optional 32-bit float or 24-bit output

## New Features

### Environment Variables
You can now control quality settings via environment variables:

```bash
# Model selection
export DEMUCS_MODEL="htdemucs_ft"  # or "htdemucs", "htdemucs_6s", etc.

# Audio quality
export USE_FLOAT32="true"  # Enable 32-bit float processing and output

# Processing parameters (advanced)
export DEMUCS_OVERLAP="0.25"  # Overlap between chunks (0.1-0.75)
export DEMUCS_SHIFTS="2"      # Number of random shifts (0-4)
```

### Quality Presets
The system now includes several quality presets:

1. **Maximum Quality** (`AUDIOPHILE_CONFIG`):
   - Model: `htdemucs_ft`
   - Overlap: 0.75
   - Shifts: 4
   - 32-bit float output
   - Processing time: ~4-5x slower but best quality

2. **High Quality** (`PRODUCTION_CONFIG`):
   - Model: `htdemucs_ft`
   - Overlap: 0.25
   - Shifts: 2
   - 32-bit float output
   - Processing time: ~2x slower, excellent quality

3. **Balanced** (`DEVELOPMENT_CONFIG`):
   - Model: `htdemucs`
   - Overlap: 0.15
   - Shifts: 1
   - 16-bit output
   - Good balance of speed and quality

4. **Fast** (`FAST_CONFIG`):
   - Model: `htdemucs_quantized`
   - Overlap: 0.10
   - Shifts: 0
   - 16-bit output
   - Fastest processing, acceptable quality

## Audio Quality Improvements

### Before (Issues):
- Grainy/noisy stems
- Audible artifacts at chunk boundaries
- Loss of dynamics due to poor normalization
- Quantization noise from 16-bit conversion

### After (Improvements):
- Cleaner separation with less noise
- Smooth transitions between chunks
- Preserved audio dynamics
- Optional high-resolution output (32-bit float)
- Soft clipping reduces harsh artifacts

## Usage Examples

### 1. Maximum Quality Setup
```bash
export DEMUCS_MODEL="htdemucs_ft"
export USE_FLOAT32="true"
export DEMUCS_OVERLAP="0.75"
export DEMUCS_SHIFTS="4"
```

### 2. Production Setup (Recommended)
```bash
export DEMUCS_MODEL="htdemucs_ft"
export USE_FLOAT32="true"
export DEMUCS_OVERLAP="0.25"
export DEMUCS_SHIFTS="2"
```

### 3. Six-Source Separation (Guitar + Piano)
```bash
export DEMUCS_MODEL="htdemucs_6s"
export USE_FLOAT32="true"
```

## Fine-Tuning Guide

### For Custom Datasets
If you need to fine-tune Demucs for specific music genres or recording styles:

1. **Prepare Training Data**:
   - Collect high-quality multi-track recordings
   - Ensure consistent audio format (48kHz/24-bit recommended)
   - Mix tracks to create training pairs

2. **Training Configuration**:
   ```python
   # Example training config
   config = {
       "model": "htdemucs",
       "learning_rate": 3e-4,
       "batch_size": 4,
       "segment_length": 10.0,
       "data_augmentation": True,
   }
   ```

3. **Data Augmentation**:
   - Pitch shifting (±2 semitones)
   - Time stretching (0.8x - 1.2x)
   - EQ variations
   - Reverb/room simulation

### Performance Monitoring
Monitor these metrics during training:
- **SDR (Signal-to-Distortion Ratio)**: Higher is better
- **SIR (Signal-to-Interference Ratio)**: Measures source separation
- **SAR (Signal-to-Artifacts Ratio)**: Measures artifact levels

## Troubleshooting

### High Memory Usage
If you encounter memory issues:
```bash
export USE_FLOAT32="false"  # Use 16-bit processing
export DEMUCS_SHIFTS="1"    # Reduce shifts
export TORCH_NUM_THREADS="2" # Limit CPU threads
```

### Slow Processing
For faster processing:
```bash
export DEMUCS_MODEL="htdemucs_quantized"
export DEMUCS_OVERLAP="0.1"
export DEMUCS_SHIFTS="0"
```

### Audio Artifacts
If you still hear artifacts:
1. Try different models (`htdemucs_ft`, `mdx_extra_q`)
2. Increase overlap: `export DEMUCS_OVERLAP="0.5"`
3. Enable soft clipping (already enabled by default)
4. Use higher bit depth: `export USE_FLOAT32="true"`

## Dependencies

The improvements require these additional packages:
- `torchaudio`: High-quality audio resampling
- `soundfile`: 32-bit float WAV output support

Install with:
```bash
pip install torchaudio soundfile
```

## Performance Impact

| Setting | Processing Time | Quality | Memory Usage |
|---------|----------------|---------|--------------|
| Fast | 1x (baseline) | Good | Low |
| Balanced | 1.5x | Very Good | Medium |
| High | 2x | Excellent | Medium-High |
| Maximum | 4-5x | Audiophile | High |

## Conclusion

These improvements should significantly reduce the noisy/grainy artifacts in your Demucs output. The default configuration now uses the fine-tuned model with optimized parameters for the best balance of quality and performance.

For production use, we recommend the "High Quality" preset. For development and testing, the "Balanced" preset provides good results with faster processing.