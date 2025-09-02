# Quick Deployment Guide

## 🚀 Immediate Vercel Deployment

Since the stem separation requires a separate Python service, here are your deployment options:

### Option 1: Deploy Frontend Only (Immediate)

The app will work for tablature generation, but stem separation will be disabled until you set up the Python service.

1. **Via Vercel Dashboard:**
   - Go to https://vercel.com/dashboard
   - Click "Add New" → "Project"
   - Import this git repository
   - Deploy automatically

2. **Via CLI:**
   ```bash
   npx vercel --prod
   ```

### Option 2: Full Deployment (Frontend + Backend)

#### Step 1: Deploy Python Service

**Railway (Recommended - Easy GPU support):**
1. Go to https://railway.app
2. Create new project from GitHub
3. Select the `python/stems` folder
4. Add environment variables if needed
5. Deploy (will auto-install dependencies)

**Alternative: Google Cloud Run:**
```bash
# Build and deploy to Cloud Run
cd python/stems
gcloud run deploy stems-service --source . --region us-central1 --allow-unauthenticated
```

#### Step 2: Deploy Frontend to Vercel

1. Set environment variable in Vercel:
   - `STEMS_SERVICE_URL` = your Python service URL
2. Deploy the Next.js app

## 📋 Pre-deployment Checklist

- ✅ Next.js app builds successfully (`npm run build`)
- ✅ All dependencies installed
- ✅ Environment variables configured
- ✅ Python service tested (optional)

## 🔧 Configuration Files Ready

The following files are configured for deployment:
- `vercel.json` - Vercel configuration
- `.vercelignore` - Files to exclude from deployment
- `.gitignore` - Git ignore patterns
- `package.json` - All dependencies included

## 🎯 What Works After Deployment

**Frontend Only:**
- ✅ Audio file upload
- ✅ Tablature generation
- ✅ Audio playback
- ✅ Export features (TXT, PDF, MIDI)
- ❌ Stem separation (requires Python service)

**Full Deployment:**
- ✅ Everything above
- ✅ Stem separation
- ✅ Stem mixer controls

## 🔍 Testing Your Deployment

1. Upload an audio file
2. Generate tablature (should work)
3. Try stem separation (only works with Python service)

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Verify environment variables
3. Test Python service independently
4. Check CORS settings for cross-origin requests