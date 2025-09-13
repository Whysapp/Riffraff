# Vercel Deployment Guide

## Automatic Deployment Options

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit with playback fix"
   git branch -M main
   git remote add origin https://github.com/yourusername/music-tab-generator.git
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository
   - Vercel will auto-detect Next.js and deploy

### Option 2: Vercel CLI Deployment

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   # or use npx
   npx vercel --version
   ```

2. **Login to Vercel**:
   ```bash
   npx vercel login
   ```

3. **Deploy**:
   ```bash
   npx vercel --prod
   ```

## Manual Deployment Steps

If you prefer to deploy manually:

```bash
# 1. Ensure clean build
rm -rf .next
npm run build

# 2. Deploy to Vercel
npx vercel --prod

# Follow the prompts:
# - Set up and deploy? [Y/n] Y
# - Which scope? (select your account)
# - Link to existing project? [y/N] N
# - Project name: music-tab-generator (or your preferred name)
# - In which directory is your code located? ./
# - Want to override the settings? [y/N] N
```

## Configuration Files Created

- **`vercel.json`**: Vercel-specific configuration
  - Extended timeout for audio processing (60s)
  - CORS headers for API routes
  - Production environment settings

- **`.vercelignore`**: Files to exclude from deployment
  - Node modules, build artifacts, IDE files
  - Optimizes deployment size and speed

## Environment Variables

No environment variables are required for this deployment. The app runs entirely client-side with Web Audio API.

## Post-Deployment Testing

After deployment, test these key features:

1. **File Upload**: Upload an audio file (MP3, WAV, etc.)
2. **Tablature Generation**: Process the audio successfully  
3. **Playback Controls**: 
   - ✅ Play button works immediately after generation
   - ✅ Pause/Resume functionality
   - ✅ Stop and restart
   - ✅ Volume control
4. **Export Features**: TXT, PDF, and MIDI exports
5. **Browser Compatibility**: Test on Chrome, Firefox, Safari

## Expected Performance

- **Build Time**: ~30-60 seconds
- **Cold Start**: ~2-3 seconds for API routes
- **Audio Processing**: Client-side (no server load)
- **File Upload Limit**: 50MB (configurable)

## Troubleshooting

### Common Issues:

1. **Build Failures**:
   ```bash
   # Clear cache and rebuild
   rm -rf .next node_modules
   npm install
   npm run build
   ```

2. **Audio Not Playing**:
   - Check browser console for Web Audio API errors
   - Ensure HTTPS deployment (required for Web Audio)
   - Test user gesture requirement (click Play button)

3. **Large File Uploads**:
   - Files are processed client-side
   - No server storage required
   - Increase Vercel function timeout if needed

### Monitoring:

- **Vercel Dashboard**: Monitor deployments and function logs
- **Browser Console**: Check for Web Audio API issues
- **Network Tab**: Verify API responses

## Domain Configuration

After deployment:

1. **Custom Domain** (optional):
   - Go to Vercel dashboard → Project → Settings → Domains
   - Add your custom domain
   - Configure DNS records as shown

2. **HTTPS**: 
   - Automatically enabled by Vercel
   - Required for Web Audio API functionality

## Scaling Considerations

- **Client-Side Processing**: No server scaling needed for audio processing
- **API Routes**: Handle metadata and exports only
- **Static Assets**: Cached globally via Vercel Edge Network
- **Concurrent Users**: Limited only by client device capabilities

## Security

- **No File Storage**: Audio files processed in browser memory only
- **CORS Configured**: API routes accessible from deployment domain
- **No Authentication**: Public app, no sensitive data handling

The deployment is optimized for the audio processing workflow and should provide excellent performance worldwide via Vercel's Edge Network.