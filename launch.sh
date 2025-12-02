#!/bin/bash

# Fastt Chat Launch Script
# Starts or restarts the application

set -e  # Exit on any error

echo "🚀 Launching Fastt Chat..."
echo ""

# Check if we're in production (EC2) or development (local)
if command -v pm2 &> /dev/null; then
    echo "🔄 Using PM2 for process management..."
    
    # Stop existing process if running
    pm2 stop fastt-server 2>/dev/null || true
    
    # Start the application
    pm2 start npm --name "fastt-server" -- start
    
    # Save PM2 configuration
    pm2 save
    
    # Set up PM2 to start on boot (only needs to be done once)
    pm2 startup systemd -u $USER --hp $HOME 2>/dev/null | grep -v "PM2" | sudo bash || true
    
    echo ""
    echo "✅ Application started with PM2!"
    echo ""
    echo "Useful commands:"
    echo "  pm2 status          - Check status"
    echo "  pm2 logs            - View logs"
    echo "  pm2 restart all     - Restart app"
    echo "  pm2 stop all        - Stop app"
    echo ""
else
    echo "🔧 Starting in development mode..."
    echo ""
    echo "Backend will run on http://localhost:3001"
    echo "Frontend dev server: cd client && npm start"
    echo ""
    
    # Start the backend server
    npm start
fi

