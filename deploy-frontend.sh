#!/bin/bash

# Frontend Deployment Script
# Use this when you changed React code (client-side)

set -e  # Exit on any error

echo "🎨 Deploying frontend changes..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Rebuild React app
echo "🔨 Building React app..."
cd client
npm run build
cd ..

# Restart the application
echo "🔄 Restarting server..."
if command -v pm2 &> /dev/null; then
    pm2 restart all
    echo "✅ Server restarted!"
else
    echo "⚠️  PM2 not found. Please restart manually."
fi

echo "✅ Frontend deployment complete! (~30 seconds)"

