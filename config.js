// Fastt Chat Configuration
// This file contains all configuration settings for the application

module.exports = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Admin Panel Security
  // Default: "admin" - CHANGE THIS IN PRODUCTION!
  // Generate a secure key: openssl rand -hex 32
  adminApiKey: process.env.ADMIN_API_KEY || 'admin',
  
  // Upload Configuration
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  
  // Socket.io Configuration
  socketConfig: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  },
  
  // Database Configuration
  database: {
    path: './server/chat.db'
  }
};

