# Deploying RiffRaff to Hugging Face Spaces

This guide will help you deploy the improved RiffRaff Demucs application to Hugging Face Spaces.

## 🚀 Quick Deploy

### Option 1: Direct Upload to Hugging Face Spaces

1. **Go to [Hugging Face Spaces](https://huggingface.co/spaces)**
2. **Click "Create new Space"**
3. **Configure your Space:**
   - **Name**: `riffraff-demucs` (or your preferred name)
   - **License**: MIT
   - **SDK**: Gradio
   - **Hardware**: CPU Basic (or GPU if you have access)

4. **Upload these files to your Space:**
   - `app.py` (main application)
   - `requirements.txt` (dependencies)
   - `README.md` (Space description)
   - `demucs_config.py` (optional configuration)

### Option 2: Git Integration

1. **Create a new Space on Hugging Face**
2. **Clone your Space repository:**
   ```bash
   git clone https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   cd YOUR_SPACE_NAME
   ```

3. **Add files from this repository:**
   ```bash
   # Copy the improved files
   cp /path/to/your/workspace/app.py .
   cp /path/to/your/workspace/requirements.txt .
   cp /path/to/your/workspace/README.md .
   cp /path/to/your/workspace/demucs_config.py .
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "Deploy improved Demucs with quality enhancements"
   git push
   ```

## ⚙️ Environment Configuration

Set these environment variables in your Hugging Face Space settings for optimal performance:

### Quality Settings
```bash
DEMUCS_MODEL=htdemucs_ft
USE_FLOAT32=true
DEMUCS_OVERLAP=0.25
DEMUCS_SHIFTS=2
MAX_DURATION_SECONDS=30
```

### Performance Settings (if needed)
```bash
TORCH_NUM_THREADS=2
```

## 🖥️ Hardware Recommendations

### CPU Spaces (Free Tier)
- **Model**: `htdemucs_quantized` or `htdemucs`
- **Settings**: `USE_FLOAT32=false`, `DEMUCS_SHIFTS=1`
- **Duration**: Keep `MAX_DURATION_SECONDS=15` for faster processing

### GPU Spaces (Paid)
- **Model**: `htdemucs_ft` (recommended)
- **Settings**: `USE_FLOAT32=true`, `DEMUCS_SHIFTS=2`
- **Duration**: Can increase `MAX_DURATION_SECONDS=60` or more

## 📁 Required Files

Make sure your Hugging Face Space includes:

```
your-space/
├── app.py                    # Main Gradio application
├── requirements.txt          # Python dependencies
├── README.md                # Space description (with YAML header)
├── demucs_config.py         # Optional: Advanced configuration
└── .gitignore              # Optional: Git ignore file
```

## 🔧 Troubleshooting

### Common Issues

1. **Out of Memory**
   - Reduce `MAX_DURATION_SECONDS`
   - Set `USE_FLOAT32=false`
   - Use `htdemucs_quantized` model

2. **Slow Processing**
   - Reduce `DEMUCS_SHIFTS` to 1 or 0
   - Lower `DEMUCS_OVERLAP` to 0.15
   - Use CPU-optimized settings

3. **Model Loading Errors**
   - Ensure `demucs>=4.0.0` in requirements.txt
   - Check model name spelling
   - Try fallback model: `htdemucs`

### Performance Optimization

For different hardware tiers:

**CPU Basic (Free)**:
```bash
DEMUCS_MODEL=htdemucs_quantized
USE_FLOAT32=false
DEMUCS_OVERLAP=0.15
DEMUCS_SHIFTS=1
MAX_DURATION_SECONDS=15
```

**CPU Upgrade**:
```bash
DEMUCS_MODEL=htdemucs
USE_FLOAT32=false
DEMUCS_OVERLAP=0.20
DEMUCS_SHIFTS=1
MAX_DURATION_SECONDS=30
```

**GPU T4**:
```bash
DEMUCS_MODEL=htdemucs_ft
USE_FLOAT32=true
DEMUCS_OVERLAP=0.25
DEMUCS_SHIFTS=2
MAX_DURATION_SECONDS=60
```

## 🌟 Quality vs Performance Trade-offs

| Setting | Quality | Speed | Memory | Cost |
|---------|---------|-------|---------|------|
| **Audiophile** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | High |
| **Production** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | Medium |
| **Balanced** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Low |
| **Fast** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | Free |

## 📝 Sample Space Configuration

Here's a complete example of environment variables for a production Space:

```bash
# Model and Quality
DEMUCS_MODEL=htdemucs_ft
USE_FLOAT32=true

# Processing Parameters  
DEMUCS_OVERLAP=0.25
DEMUCS_SHIFTS=2
MAX_DURATION_SECONDS=30

# Performance
TORCH_NUM_THREADS=4

# Optional: Gradio Settings
GRADIO_THEME=default
GRADIO_SHARE=false
```

## 🔄 Updating Your Space

To update your deployed Space with new improvements:

1. **Pull latest changes** from your GitHub repository
2. **Update files** in your Hugging Face Space
3. **Push changes** - Space will automatically rebuild
4. **Monitor logs** for any deployment issues

## 📊 Monitoring

After deployment, monitor:
- **Build logs** for errors
- **Runtime performance** 
- **User feedback**
- **Resource usage**

Your improved Demucs application should now provide significantly better audio quality compared to standard implementations!