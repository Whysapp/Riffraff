# Vercel Deployment Guide

## Fixed Issues

✅ **Submodule Error Resolved**: Removed the problematic `RiffRaff` submodule that was causing Vercel deployment failures.

## Deployment Steps

### 1. Deploy from the music-tab-generator directory

```bash
cd music-tab-generator
vercel --prod
```

### 2. Environment Variables (Optional)

If you plan to deploy the HuggingFace proxy service, set this environment variable in Vercel:

- `HF_PROXY_URL`: URL of your deployed proxy service (e.g., `https://your-proxy.railway.app`)

### 3. Vercel Configuration

The `vercel.json` file is already configured with:
- ✅ Extended timeouts for API routes (60-120 seconds)
- ✅ CORS headers for API endpoints
- ✅ Next.js framework detection
- ✅ Proper build commands

## Current Architecture

### Without Proxy Service
- Frontend calls HuggingFace Spaces APIs directly
- Fallback to mock responses if APIs fail
- **Pros**: Simple deployment, no additional services needed
- **Cons**: Limited error handling, potential CORS issues

### With Proxy Service (Recommended)
- Frontend → Vercel API Routes → HuggingFace Proxy → HuggingFace Spaces
- Better error handling and retry logic
- **Pros**: More reliable, better error handling
- **Cons**: Requires additional service deployment

## HuggingFace Proxy Deployment (Optional but Recommended)

### Railway (Recommended)
```bash
cd ../hf-api-proxy
# Connect to Railway and deploy
railway login
railway init
railway up
```

### Render
```bash
cd ../hf-api-proxy
# Create new Web Service on Render
# Build Command: pip install -r requirements.txt
# Start Command: uvicorn app:app --host 0.0.0.0 --port $PORT
```

### After Proxy Deployment
1. Get the proxy service URL (e.g., `https://your-service.railway.app`)
2. Set `HF_PROXY_URL` environment variable in Vercel
3. Redeploy the Vercel application

## Testing the Deployment

1. **Upload an audio file** (MP3, WAV, etc.)
2. **Test tablature generation** - should work with HuggingFace or fallback
3. **Test stem separation** - should work with HuggingFace or show error
4. **Check browser console** for any API errors

## Troubleshooting

### Common Issues

1. **API Timeouts**
   - Vercel functions have a 60-120 second limit
   - Large audio files may timeout
   - Solution: Implement file size limits or chunked processing

2. **CORS Errors**
   - HuggingFace Spaces may block direct browser requests
   - Solution: Use the proxy service

3. **Memory Limits**
   - Vercel has memory limits for serverless functions
   - Solution: Process smaller files or use streaming

### Monitoring

Check these in Vercel dashboard:
- Function execution times
- Error rates
- Memory usage
- Invocation counts

## Success Indicators

✅ **Deployment successful** - No build errors
✅ **Audio upload works** - Files can be uploaded
✅ **Tablature generation** - Either HuggingFace or fallback works
✅ **UI responsive** - All buttons and features work
✅ **Error handling** - Graceful error messages shown

## Next Steps After Successful Deployment

1. **Test with real audio files** of different formats and sizes
2. **Monitor performance** and error rates
3. **Deploy proxy service** for better reliability
4. **Add caching** to reduce API calls
5. **Implement usage analytics** to track feature adoption

## URLs

- **Frontend**: Your Vercel deployment URL
- **Proxy Service**: Your Railway/Render deployment URL (if deployed)
- **HuggingFace Spaces**:
  - Stem Separation: `https://huggingface.co/spaces/ahk-d/Spleeter-HT-Demucs-Stem-Separation-2025`
  - Guitar Tabs: `https://huggingface.co/spaces/JonathanJH/guitar-tabs-ai`