#!/bin/bash

# Quick Deployment Script - Server Changes Only
# Use this when you only changed server-side code (no React changes)

set -e  # Exit on any error

echo "⚡ Quick deployment (server-only)..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Restart the application
echo "🔄 Restarting server..."
if command -v pm2 &> /dev/null; then
    pm2 restart all
    echo "✅ Server restarted!"
else
    echo "⚠️  PM2 not found. Please restart manually."
fi

echo "✅ Quick deployment complete! (~5 seconds)"

