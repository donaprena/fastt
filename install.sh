#!/bin/bash

# Fastt Chat Installation Script
# Installs Node.js, dependencies, and builds the application

set -e  # Exit on any error

echo "🚀 Installing Fastt Chat..."
echo ""

# Check if we're on Ubuntu/Debian (EC2) or Mac/local
if command -v apt-get &> /dev/null; then
    echo "📦 Detected Ubuntu/Debian system"
    
    # Update system packages
    echo "📦 Updating system packages..."
    sudo apt update
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        echo "📦 Installing Node.js 20.x LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    # Install build essentials
    echo "📦 Installing build essentials..."
    sudo apt install -y build-essential
    
    # Install PM2 globally for process management
    if ! command -v pm2 &> /dev/null; then
        echo "📦 Installing PM2..."
        sudo npm install -g pm2
    fi
    
    echo "✅ Node.js version: $(node --version)"
    echo "✅ npm version: $(npm --version)"
    echo "✅ PM2 version: $(pm2 --version)"
else
    echo "📦 Detected local development system"
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js 18+ first:"
        echo "   https://nodejs.org/"
        exit 1
    fi
    
    echo "✅ Node.js version: $(node --version)"
    echo "✅ npm version: $(npm --version)"
fi

echo ""
echo "📦 Installing backend dependencies..."
npm install

echo ""
echo "📦 Installing frontend dependencies..."
cd client
npm install

echo ""
echo "🔨 Building React app..."
npm run build

cd ..

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. (Optional) Configure environment: nano .env"
echo "  2. Launch the app: ./launch.sh"
echo ""

