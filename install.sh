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

# Ask about Nginx setup (only on Ubuntu/Debian)
if command -v apt-get &> /dev/null; then
    read -p "Would you like to set up Nginx reverse proxy? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "📦 Installing Nginx..."
        sudo apt install -y nginx
        
        read -p "Enter your domain name (e.g., fastt.chat): " DOMAIN
        
        if [ -n "$DOMAIN" ]; then
            echo "⚙️  Creating Nginx configuration for $DOMAIN..."
            
            sudo tee /etc/nginx/sites-available/fastt > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    client_max_body_size 10M;
}
EOF
            
            sudo ln -sf /etc/nginx/sites-available/fastt /etc/nginx/sites-enabled/
            sudo rm -f /etc/nginx/sites-enabled/default
            
            sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx
            
            echo "✅ Nginx configured successfully!"
            echo ""
            echo "🔒 To enable SSL, run:"
            echo "   sudo apt install certbot python3-certbot-nginx"
            echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        fi
    fi
fi

echo ""
echo "Next steps:"
echo "  1. (Optional) Edit config: nano config.js"
echo "  2. Launch the app: ./launch.sh"
echo ""

