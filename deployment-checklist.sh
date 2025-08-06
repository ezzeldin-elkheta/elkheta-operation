#!/bin/bash

echo "🚀 Pre-deployment checklist for Vercel"
echo "======================================="

echo "✅ 1. Build successful - dist folder created"
if [ -d "dist" ]; then
    echo "   📁 dist folder exists"
    echo "   📄 dist contains $(ls dist | wc -l) files"
else
    echo "   ❌ dist folder missing!"
    exit 1
fi

echo ""
echo "✅ 2. API endpoints configured"
if [ -f "pages/api/proxy/create-video.js" ]; then
    echo "   📄 create-video.js exists"
else
    echo "   ❌ create-video.js missing!"
    exit 1
fi

if [ -f "pages/api/diagnostics.js" ]; then
    echo "   📄 diagnostics.js exists"
else
    echo "   ❌ diagnostics.js missing!"
    exit 1
fi

echo ""
echo "✅ 3. Configuration files ready"
if [ -f "vercel.json" ]; then
    echo "   📄 vercel.json exists"
else
    echo "   ❌ vercel.json missing!"
    exit 1
fi

if [ -f "package.json" ]; then
    echo "   📄 package.json exists"
else
    echo "   ❌ package.json missing!"
    exit 1
fi

echo ""
echo "✅ 4. Environment variables needed:"
echo "   🔑 VITE_BUNNY_API_KEY (set in Vercel dashboard)"
echo "   📝 GOOGLE_SHEETS_CREDENTIALS_JSON"
echo "   📊 GOOGLE_SHEETS_SPREADSHEET_ID"

echo ""
echo "🎯 Key testing endpoints after deployment:"
echo "   🩺 /api/diagnostics - System health check"
echo "   🎬 /api/proxy/create-video - Video creation"
echo "   📚 /api/proxy/base/videolibrary - Library access"
echo "   🗂️ /api/proxy/video/library/{id}/collections - Collections"

echo ""
echo "⚠️  Important notes:"
echo "   • Use library-specific API keys (not main API key)"
echo "   • Test with library 301922 and key: b28a***442-2c9d-4e0d"
echo "   • All proxy endpoints preserve library-specific authentication"
echo "   • Sheet updates work with existing Google Service Account"

echo ""
echo "🚀 Ready for deployment to Vercel!"
echo "🌐 Expected URL: https://014-vercel-app-url.vercel.app"
