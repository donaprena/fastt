#!/bin/bash

# Fastt Chat Deployment Script for EC2
# This script pulls the latest changes and restarts the application

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies and build
echo "📦 Installing frontend dependencies..."
cd client
npm install

echo "🔨 Building React app..."
npm run build

# Return to root directory
cd ..

# Restart the application
echo "🔄 Restarting application..."

# Check if PM2 is being used
if command -v pm2 &> /dev/null; then
    echo "   Using PM2..."
    pm2 restart all || pm2 start npm --name "fastt-server" -- start
    pm2 save
elif systemctl is-active --quiet fastt; then
    echo "   Using systemd..."
    sudo systemctl restart fastt
else
    echo "   No process manager detected. Please restart manually."
    echo "   You can start the server with: npm start"
fi

echo "✅ Deployment complete!"
echo "🌐 Your app should now be running with the latest changes."

