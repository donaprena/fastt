# Fastt Chat Application

A high-performance real-time chat application designed for emergency situations. Features include:

- **High Throughput**: Optimized to handle many messages per second
- **No Authentication**: Anonymous users can join immediately
- **Image Support**: Upload and share images in real-time
- **Real-time Updates**: WebSocket-based instant messaging
- **Modern UI**: Clean, responsive design

## Features

- Real-time messaging via WebSockets (Socket.io)
- Image upload and sharing
- Typing indicators
- Message persistence (SQLite database)
- Anonymous user system (no login required)
- Responsive design for mobile and desktop
- Optimized for high message throughput

## Tech Stack

### Backend
- Node.js + Express
- Socket.io for WebSocket communication
- SQLite for message storage
- Multer for image upload handling

### Frontend
- React
- Socket.io-client for real-time updates
- Axios for HTTP requests
- Modern CSS with responsive design

## Installation

1. Install backend dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd client
npm install
cd ..
```

## Running the Application

### Development Mode (runs both server and client)
```bash
npm run dev
```

### Or run separately:

**Backend Server:**
```bash
npm run server
```

**Frontend Client:**
```bash
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Production Build

1. Build the React app:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The server will serve the built React app and handle API requests.

## Configuration

- Default backend port: 3001
- Default frontend port: 3000
- Image upload limit: 10MB
- Supported image formats: JPEG, JPG, PNG, GIF, WEBP

You can set the API URL via environment variable:
```bash
REACT_APP_API_URL=http://your-server:3001 npm start
```

## Performance Optimizations

- Database indexes on timestamp for fast message queries
- Efficient WebSocket connection handling
- Image lazy loading
- Optimized message broadcasting
- Connection pooling ready

## Project Structure

```
emergency-chat/
├── server/
│   ├── index.js          # Main server file
│   ├── database.js       # Database operations
│   ├── utils.js          # Utility functions
│   └── uploads/          # Uploaded images (created automatically)
├── client/
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── App.css       # Styles
│   │   └── index.js      # React entry point
│   └── public/
└── package.json
```

## Notes

- Messages are stored in SQLite database (`server/chat.db`)
- Images are stored in `server/uploads/` directory
- No user authentication - all users are anonymous
- Each user gets a random username on connection

