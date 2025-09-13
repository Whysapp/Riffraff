#!/bin/bash

# Music Tab Generator - Vercel Deployment Script
# Run this script to deploy to Vercel

set -e

echo "🎵 Music Tab Generator - Vercel Deployment"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if Vercel CLI is available
if ! command -v vercel &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: Neither 'vercel' nor 'npx' is available. Please install Node.js and npm."
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
echo "🚀 Ready to deploy to Vercel!"
echo ""
echo "Choose your deployment method:"
echo "1. GitHub Integration (Recommended)"
echo "2. Direct CLI Deployment"
echo ""

read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "📋 GitHub Integration Steps:"
        echo "1. Push your code to GitHub:"
        echo "   git init"
        echo "   git add ."
        echo "   git commit -m 'Add music tab generator with playback fix'"
        echo "   git branch -M main"
        echo "   git remote add origin https://github.com/yourusername/music-tab-generator.git"
        echo "   git push -u origin main"
        echo ""
        echo "2. Go to https://vercel.com"
        echo "3. Sign in with GitHub"
        echo "4. Click 'New Project' and import your repository"
        echo "5. Vercel will auto-detect Next.js and deploy automatically"
        ;;
    2)
        echo ""
        echo "🔑 CLI Deployment Steps:"
        echo "1. Login to Vercel (if not already logged in):"
        echo "   npx vercel login"
        echo ""
        echo "2. Deploy to production:"
        echo "   npx vercel --prod"
        echo ""
        echo "Starting CLI deployment..."
        
        # Check if already logged in
        if npx vercel whoami &> /dev/null; then
            echo "✅ Already logged in to Vercel"
        else
            echo "🔑 Please login to Vercel..."
            npx vercel login
        fi
        
        echo "🚀 Deploying to production..."
        npx vercel --prod
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and choose 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment initiated!"
echo ""
echo "📋 Post-deployment checklist:"
echo "✅ Test file upload functionality"
echo "✅ Test tablature generation" 
echo "✅ Test Play/Pause/Stop controls"
echo "✅ Test volume control"
echo "✅ Test export features (TXT, PDF, MIDI)"
echo "✅ Test on different browsers (Chrome, Firefox, Safari)"
echo ""
echo "🔗 Your app will be available at: https://your-project-name.vercel.app"
echo ""
echo "For troubleshooting, check:"
echo "• Vercel dashboard: https://vercel.com/dashboard"
echo "• Browser console for Web Audio API errors"
echo "• DEPLOYMENT.md for detailed instructions"