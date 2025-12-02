# Deployment Guide

## Quick Production Launch

### Automated Production Setup (Recommended)
```bash
# 1. Clone the repository
git clone https://github.com/donaprena/fastt.git
cd fastt

# 2. Run the setup script (installs Node.js, npm, PM2)
chmod +x setup-ec2.sh
./setup-ec2.sh

# 3. Edit the launch script with your email for SSL certificates
nano launch-production.sh
# Change: EMAIL="your-email@example.com" to your actual email

# 4. Launch to production (sets up Nginx, SSL, and deploys)
chmod +x launch-production.sh
./launch-production.sh
```

**That's it!** Your site will be live at https://fastt.chat

---

## Initial Setup on EC2

### 1. Clone the repository
```bash
cd ~
git clone https://github.com/donaprena/fastt.git
cd fastt
```

### 2. Install dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3. Build the React app
```bash
cd client
npm run build
cd ..
```

### 4. Set up PM2 (recommended for production)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start npm --name "fastt-server" -- start

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the instructions from the command above
```

### 5. Configure firewall (if needed)
```bash
# Allow traffic on ports 3000 and 3001
sudo ufw allow 3000
sudo ufw allow 3001
```

## Deploying Updates

### Quick deployment (recommended)
Simply run the deployment script:
```bash
cd ~/fastt
./deploy.sh
```

### Manual deployment
```bash
cd ~/fastt

# Pull latest changes
git pull origin main

# Install dependencies
npm install
cd client
npm install

# Rebuild React app
npm run build
cd ..

# Restart with PM2
pm2 restart all
```

## Troubleshooting

### Check application logs
```bash
# For PM2
pm2 logs fastt-server

# Or check the process
pm2 status
```

### Restart the application
```bash
pm2 restart all
```

### Stop the application
```bash
pm2 stop all
```

### View running processes
```bash
pm2 list
```

## Environment Variables

If you need to set environment variables, create a `.env` file in the root directory:
```bash
# Example .env file
PORT=3001
REACT_APP_API_URL=http://your-ec2-ip:3001
```

## Notes

- The server runs on port 3001
- The built React app is served by the Express server
- Make sure your EC2 security group allows inbound traffic on the required ports
- Database and uploaded images are stored in `server/` directory

