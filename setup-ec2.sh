#!/bin/bash

# EC2 Initial Setup Script for Fastt Chat
# This script installs all required dependencies on a fresh Ubuntu EC2 instance

set -e  # Exit on any error

echo "🔧 Setting up EC2 instance for Fastt Chat..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install Node.js and npm using NodeSource repository (Node.js 20.x LTS)
echo "📦 Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install Git (if not already installed)
echo "📦 Installing Git..."
sudo apt install -y git

# Install PM2 globally for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install build essentials (needed for some npm packages)
echo "📦 Installing build essentials..."
sudo apt install -y build-essential

echo ""
echo "✅ EC2 setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone the repository: git clone https://github.com/donaprena/fastt.git"
echo "2. Navigate to directory: cd fastt"
echo "3. Run deployment: ./deploy.sh"
echo ""

