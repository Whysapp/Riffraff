#!/bin/bash

# Deploy to existing Vercel project: whysapps-projects/riffraff
# Run this script to deploy your music tab generator

set -e

echo "🎵 Deploying to existing Vercel project: riffraff"
echo "================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🏗️  Building the project..."
rm -rf .next
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors above."
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "🔑 Authenticating with Vercel..."

# Check if already logged in
if npx vercel whoami &> /dev/null; then
    echo "✅ Already logged in to Vercel"
else
    echo "🔑 Please login to Vercel..."
    npx vercel login
fi

echo ""
echo "🔗 Linking to existing project..."
# This will prompt to link to existing project
npx vercel link

echo ""
echo "🚀 Deploying to production..."
npx vercel --prod

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🔗 Your app should be live at: https://riffraff-whysapps-projects.vercel.app"
echo "   (or check your Vercel dashboard for the exact URL)"
echo ""
echo "📋 Post-deployment checklist:"
echo "✅ Test file upload functionality"
echo "✅ Test tablature generation" 
echo "✅ Test Play/Pause/Stop controls"
echo "✅ Test volume control"
echo "✅ Test export features (TXT, PDF, MIDI)"
echo "✅ Test API endpoints are working"
echo ""
echo "🔧 Troubleshooting:"
echo "• Check Vercel dashboard: https://vercel.com/whysapps-projects/riffraff"
echo "• View deployment logs in Vercel dashboard"
echo "• Test API endpoints: /api/upload-audio, /api/process-audio, /api/stems/separate"