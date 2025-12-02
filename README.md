# Fastt Chat

A high-performance real-time chat application with instant message delivery, image sharing, and real-time collaboration.

![Paper Airplane Logo](client/public/favicon.svg)

## 🚀 Features

- ✅ **Real-time messaging** - WebSocket-based instant communication
- ✅ **Image sharing** - Upload and share images (up to 10MB)
- ✅ **Multiple chat rooms** - Create unlimited public or private rooms
- ✅ **No sign-up required** - Anonymous, instant access
- ✅ **Message reactions** - Like messages with double-tap
- ✅ **Share links** - Share specific messages with OpenGraph support
- ✅ **Username system** - Set custom display names
- ✅ **Typing indicators** - See who's typing in real-time
- ✅ **Mobile optimized** - PWA-ready with responsive design
- ✅ **Admin dashboard** - Monitor stats, users, and performance

## 🛠️ Tech Stack

### Backend
- **Node.js** + Express
- **Socket.io** for WebSocket communication
- **SQLite** for message persistence
- **Multer** for image uploads
- **Swagger** for API documentation

### Frontend
- **React** 18
- **Socket.io-client** for real-time updates
- **Axios** for HTTP requests
- **React Router** for navigation
- **React Helmet** for dynamic meta tags

## 📦 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/donaprena/fastt.git
cd fastt
```

2. **Install and launch:**
```bash
chmod +x install.sh launch.sh
./install.sh  # Installs all dependencies
./launch.sh   # Starts the application
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs

## 🌐 Production Deployment (EC2)

### Initial Setup

1. **Clone on your EC2 instance:**
```bash
git clone https://github.com/donaprena/fastt.git
cd fastt
```

2. **Run installation:**
```bash
chmod +x install.sh
./install.sh
```

This will:
- Install Node.js 20.x LTS
- Install all dependencies (backend & frontend)
- Build the React app
- Set up PM2 process manager

3. **Configure environment (optional):**
```bash
nano .env
```

Add your settings:
```env
PORT=3001
NODE_ENV=production
ADMIN_API_KEY=your-secure-api-key
```

4. **Launch the application:**
```bash
./launch.sh
```

The app runs on port 3001. Use Nginx as reverse proxy for production.

### Nginx Configuration (Recommended)

Create `/etc/nginx/sites-available/fastt`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    client_max_body_size 10M;
}
```

Enable and start:
```bash
sudo ln -s /etc/nginx/sites-available/fastt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Updates & Deployment

To deploy updates:
```bash
git pull origin main
./launch.sh
```

PM2 will automatically restart the application.

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Admin Panel Security
ADMIN_API_KEY=admin  # Change this in production!

# Optional
REACT_APP_API_URL=https://your-domain.com
```

### Admin Panel

Access the admin dashboard at `/admin`:
- **Default API key:** `admin` (change in production!)
- Monitor stats, rooms, messages, page views
- Delete all data (with confirmation)

Generate a secure API key:
```bash
openssl rand -hex 32
```

## 📚 API Documentation

Interactive API documentation available at:
```
http://localhost:3001/api/docs
```

### Key Endpoints

**Rooms:**
- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:slug` - Get room details
- `PUT /api/rooms/:slug` - Update room title
- `DELETE /api/rooms/:slug` - Delete room

**Messages:**
- `GET /api/rooms/:roomId/messages` - Get recent messages
- `GET /api/messages/:messageId` - Get message with context
- `POST /api/upload` - Upload image

**Admin (requires API key):**
- `GET /admin/api/stats` - Overall statistics
- `GET /admin/api/messages` - Recent messages
- `GET /admin/api/rooms` - Room list
- `POST /admin/api/delete-all-data` - Delete all data

## 🎨 Features in Detail

### Real-time Messaging
- Instant message delivery via WebSocket
- Automatic reconnection on network issues
- Message persistence in SQLite

### Image Sharing
- Support for JPEG, PNG, GIF, WebP
- 10MB max file size
- Lazy loading for performance

### Room System
- Public and private rooms
- Unique shareable URLs
- Room creator controls (rename, delete)

### Social Sharing
- OpenGraph meta tags for rich previews
- Share specific messages with `?msg=` parameter
- Automatic image previews when sharing

### User Experience
- Double-tap or double-click to like messages
- Native share on mobile, clipboard on desktop
- Toast notifications for actions
- Scroll to bottom on load
- Load older messages on scroll

## 🗂️ Project Structure

```
fastt/
├── server/
│   ├── index.js          # Main server file
│   ├── database.js       # SQLite operations
│   ├── utils.js          # Utility functions
│   ├── admin.html        # Admin dashboard
│   └── uploads/          # Uploaded images
├── client/
│   ├── src/
│   │   ├── App.js        # Main chat component
│   │   ├── Homepage.js   # Room list & creation
│   │   ├── App.css       # Styles
│   │   └── index.js      # React entry point
│   ├── public/
│   │   ├── index.html    # HTML template
│   │   └── favicon.svg   # Paper airplane logo
│   └── build/            # Production build
├── install.sh            # Installation script
├── launch.sh             # Launch script
├── .env.example          # Environment variables template
└── README.md             # This file
```

## 🔒 Security

- Admin panel protected with API key
- Input validation and sanitization
- CORS configured for security
- Rate limiting ready (add as needed)
- No authentication = anonymous users

**Production Checklist:**
- [ ] Change `ADMIN_API_KEY` from default
- [ ] Set up Nginx reverse proxy
- [ ] Enable SSL with Let's Encrypt
- [ ] Configure firewall (allow 80, 443)
- [ ] Regular backups of SQLite database
- [ ] Monitor logs with PM2

## 📊 Performance

- **High throughput:** Optimized for many messages/second
- **Database indexes:** Fast message queries
- **Lazy loading:** Images load on demand
- **WebSocket:** Efficient bi-directional communication
- **PM2 clustering:** Scale across CPU cores

## 🐛 Troubleshooting

### Server won't start
```bash
# Check logs
pm2 logs fastt-server

# Restart
pm2 restart all
```

### Port already in use
```bash
# Find process using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>
```

### Database locked
```bash
# Stop all processes
pm2 stop all

# Remove lock file
rm server/chat.db-journal

# Restart
pm2 start all
```

### Clear all data
Visit `/admin` and use the "Delete All Data" button, or:
```bash
rm server/chat.db
rm -rf server/uploads/*
./launch.sh
```

## 📝 License

MIT License - feel free to use this project however you'd like!

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 💬 Support

- **Issues:** https://github.com/donaprena/fastt/issues
- **Discussions:** https://github.com/donaprena/fastt/discussions

## 🎯 Roadmap

- [ ] End-to-end encryption
- [ ] File attachments (PDF, documents)
- [ ] Voice messages
- [ ] Video calls
- [ ] Desktop app (Electron)
- [ ] Message search
- [ ] Thread replies
- [ ] User mentions (@username)
- [ ] Emoji reactions
- [ ] Dark mode

---

**Made with ❤️ and ✈️ by the Fastt team**

Live at: https://fastt.chat
