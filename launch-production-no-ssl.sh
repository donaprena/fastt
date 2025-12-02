#!/bin/bash

# Fastt Chat Production Launch Script (Without SSL)
# This script sets up the production environment on EC2 without SSL certificates

set -e  # Exit on any error

DOMAIN="fastt.chat"

echo "🚀 Launching Fastt Chat to Production (HTTP only)..."
echo "Domain: $DOMAIN"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Please don't run this script as root. Run as ubuntu user with sudo access."
    exit 1
fi

# Update and install dependencies
echo "📦 Installing Nginx..."
sudo apt update
sudo apt install -y nginx

# Stop nginx temporarily
sudo systemctl stop nginx

# Create Nginx configuration
echo "⚙️  Configuring Nginx for $DOMAIN..."
sudo tee /etc/nginx/sites-available/fastt > /dev/null <<'EOF'
server {
    listen 80;
    server_name fastt.chat www.fastt.chat;

    # Serve React app and API
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    client_max_body_size 10M;  # Allow image uploads up to 10MB
}
EOF

# Enable the site
echo "🔗 Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/fastt /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "✅ Testing Nginx configuration..."
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Deploy the application
echo "📦 Deploying application..."
./deploy.sh

# Wait for app to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check if app is running
if pm2 list | grep -q "online"; then
    echo "✅ Application is running!"
else
    echo "⚠️  Warning: Application may not be running. Check with: pm2 logs"
fi

# Set up PM2 to start on boot
echo "🔧 Configuring PM2 startup..."
pm2 startup systemd -u $USER --hp $HOME | grep -v "PM2" | sudo bash
pm2 save

# Final checks
echo ""
echo "🎉 Production launch complete!"
echo ""
echo "Your site is now live at:"
echo "  🌐 http://$DOMAIN"
echo "  🌐 http://$(curl -s ifconfig.me)"
echo ""
echo "⚠️  Note: Site is running on HTTP (not HTTPS)"
echo "    Add SSL later with: sudo certbot --nginx -d fastt.chat -d www.fastt.chat"
echo ""
echo "Useful commands:"
echo "  📊 Check status: pm2 status"
echo "  📝 View logs: pm2 logs fastt-server"
echo "  🔄 Restart app: pm2 restart all"
echo "  🔍 Check Nginx: sudo nginx -t"
echo "  📋 Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo "Next steps:"
echo "  1. Visit http://$DOMAIN or http://$(curl -s ifconfig.me) and test the app"
echo "  2. When ready, install SSL: sudo apt install certbot python3-certbot-nginx"
echo "  3. Get certificate: sudo certbot --nginx -d fastt.chat -d www.fastt.chat"
echo ""

