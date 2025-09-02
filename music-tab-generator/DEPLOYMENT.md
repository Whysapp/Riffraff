# Deployment Guide

## Vercel Deployment (Frontend)

The Next.js frontend can be deployed to Vercel, but the Python stem separation service needs to be hosted separately.

### Option 1: Automatic Deployment via Git

1. Push this repository to GitHub
2. Connect your GitHub repo to Vercel at https://vercel.com
3. Set environment variables in Vercel dashboard:
   - `STEMS_SERVICE_URL`: URL of your Python service

### Option 2: Manual Deployment via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option 3: Deploy with Token

```bash
# Set your token
export VERCEL_TOKEN=your_token_here

# Deploy
vercel --prod --token $VERCEL_TOKEN
```

## Python Service Deployment Options

The stem separation service needs a persistent server that supports:
- Python 3.10+
- GPU acceleration (recommended)
- Long-running processes
- File uploads

### Recommended Platforms:

1. **Railway** (easiest for Python + GPU)
   - Supports Docker deployments
   - GPU instances available
   - Good for ML workloads

2. **Google Cloud Run** (serverless, CPU only)
   - Increase timeout to 15+ minutes
   - CPU-only processing (slower)

3. **DigitalOcean App Platform**
   - Docker support
   - CPU instances

4. **AWS EC2 with Docker**
   - Full control
   - GPU instances available (p2, p3, g4 series)

### Example Railway Deployment:

1. Create account at railway.app
2. Connect your GitHub repo
3. Deploy from the `python/stems` directory
4. Set environment variables if needed
5. Update `STEMS_SERVICE_URL` in Vercel

### Example Docker Commands:

```bash
# Build and run locally
cd python/stems
docker build -t stems-service .
docker run -p 8001:8001 stems-service

# For GPU support
docker run --gpus all -p 8001:8001 stems-service
```

## Environment Variables

Set these in your deployment platform:

### Vercel (Frontend):
- `STEMS_SERVICE_URL`: Your Python service URL

### Python Service:
- No special environment variables needed
- Demucs models download automatically on first use

## Production Considerations

1. **CORS**: The Python service may need CORS headers for cross-origin requests
2. **Rate Limiting**: Consider adding rate limiting to prevent abuse
3. **File Size Limits**: Both platforms have upload limits
4. **Timeout Settings**: Stem separation can take several minutes
5. **Model Caching**: First request downloads models (~1GB), subsequent requests are faster

## Monitoring

- Check Vercel function logs for frontend issues
- Monitor Python service logs for processing errors
- Set up health checks for the Python service

## Scaling

- Vercel handles frontend scaling automatically
- Python service may need horizontal scaling for high traffic
- Consider queueing system for batch processing