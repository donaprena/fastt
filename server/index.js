const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('../config');
const { initDatabase, saveMessage, getRecentMessages, getOlderMessages, getMessageById, getMessagesAround, toggleLike, getLikeCount, getLikesForMessages, userLikedMessage, getUserLikedMessages, createRoom, getRoom, getAllRooms, getUserRooms, updateRoomTitle, deleteRoom, getOrCreateUser, updateUserNickname, getUser, trackPageView, getAdminStats, getMessagesStats, getRoomsStats, getPageViewsStats, getPerformanceMetrics, deleteAllData } = require('./database');
const { generateRoomSlug } = require('./utils');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, config.socketConfig);

const PORT = config.port;
const ADMIN_API_KEY = config.adminApiKey;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Page view tracking middleware (skip admin and API routes)
app.use((req, res, next) => {
  // Skip tracking for admin pages, API calls, uploads, and static assets
  const skipPaths = ['/admin', '/api', '/uploads', '/static', '/favicon', '/logo', '/manifest'];
  const shouldSkip = skipPaths.some(path => req.path.startsWith(path));
  
  if (!shouldSkip) {
    const userAgent = req.get('user-agent');
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    trackPageView(req.path, userAgent, ip).catch(err => {
      console.error('Error tracking page view:', err);
    });
  }
  next();
});

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fastt Chat API',
      version: '1.0.0',
      description: 'API documentation for the Fastt Chat application',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: [path.join(__dirname, 'index.js')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = config.allowedImageTypes;
    const mimetype = allowedTypes.includes(file.mimetype);
    
    if (mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload an image file
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *                   example: /uploads/1234567890-123456789.jpg
 *       400:
 *         description: No image file provided
 */
// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: List of all rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   slug:
 *                     type: string
 *                   title:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                   lastMessageAt:
 *                     type: string
 *       500:
 *         description: Failed to fetch rooms
 */
// Get all rooms (filtered by user participation if userId provided)
app.get('/api/rooms', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, return only rooms where user has participated
    if (userId) {
      const rooms = await getUserRooms(userId);
      res.json(rooms);
    } else {
      // Otherwise return all public rooms (for backward compatibility)
      const rooms = await getAllRooms();
      res.json(rooms);
    }
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "New Chat Room"
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: "Whether the room should appear in public room lists"
 *     responses:
 *       200:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug:
 *                   type: string
 *                 title:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                 lastMessageAt:
 *                   type: string
 *       500:
 *         description: Failed to create room
 */
// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const { title, isPublic = true, userId } = req.body;
    
    // Generate a unique slug
    let slug = generateRoomSlug();
    let attempts = 0;
    const maxAttempts = 10;
    
    // Ensure slug is unique (check if room exists)
    while (attempts < maxAttempts) {
      const existingRoom = await getRoom(slug);
      if (!existingRoom) {
        break; // Slug is unique
      }
      slug = generateRoomSlug();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: 'Failed to generate unique room ID. Please try again.' });
    }
    
    const creatorId = userId ? parseInt(userId) : null;
    const room = await createRoom(slug, title || 'New Chat Room', isPublic, creatorId);
    res.json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ error: error.message || 'Failed to create room' });
  }
});

/**
 * @swagger
 * /api/rooms/{slug}:
 *   get:
 *     summary: Get room by slug
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Room slug identifier
 *     responses:
 *       200:
 *         description: Room details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug:
 *                   type: string
 *                 title:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                 lastMessageAt:
 *                   type: string
 *       404:
 *         description: Room not found
 *       500:
 *         description: Failed to fetch room
 */
// Get room by slug
app.get('/api/rooms/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const room = await getRoom(slug);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

/**
 * @swagger
 * /api/rooms/{slug}:
 *   put:
 *     summary: Update room title (creator only)
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Room slug identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - userId
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated Room Title"
 *               userId:
 *                 type: integer
 *                 example: 1
 *                 description: User ID of the room creator
 *     responses:
 *       200:
 *         description: Room title updated successfully
 *       403:
 *         description: User is not the room creator
 *       404:
 *         description: Room not found
 */
// Update room title (creator only)
app.put('/api/rooms/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, userId } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if room exists and get creator
    const room = await getRoom(slug);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if user is the creator
    if (!room.creatorId || parseInt(room.creatorId) !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only the room creator can update the title' });
    }
    
    await updateRoomTitle(slug, title);
    
    // Return updated room
    const updatedRoom = await getRoom(slug);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room title:', error);
    res.status(500).json({ error: 'Failed to update room title' });
  }
});

/**
 * @swagger
 * /api/rooms/{slug}:
 *   delete:
 *     summary: Delete room (creator only)
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Room slug identifier
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID of the room creator
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       403:
 *         description: User is not the room creator
 *       404:
 *         description: Room not found
 */
// Delete room (creator only)
app.delete('/api/rooms/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if room exists and get creator
    const room = await getRoom(slug);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if user is the creator
    if (!room.creatorId || parseInt(room.creatorId) !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only the room creator can delete the room' });
    }
    
    await deleteRoom(slug);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomId}/messages:
 *   get:
 *     summary: Get recent messages for a room
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   roomId:
 *                     type: string
 *                   userId:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   text:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                   likeCount:
 *                     type: integer
 *       500:
 *         description: Failed to fetch messages
 */
// Get recent messages endpoint
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await getRecentMessages(roomId, limit);
    
    // Get like counts for all messages
    const messageIds = messages.map(m => m.id);
    const likes = await getLikesForMessages(messageIds);
    
    // Add like counts to messages
    const messagesWithLikes = messages.map(msg => ({
      ...msg,
      likeCount: likes[msg.id] || 0
    }));
    
    res.json(messagesWithLikes);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get older messages endpoint (for pagination)
app.get('/api/rooms/:roomId/messages/older', async (req, res) => {
  try {
    const { roomId } = req.params;
    const beforeTimestamp = req.query.before;
    const limit = parseInt(req.query.limit) || 30;
    
    if (!beforeTimestamp) {
      return res.status(400).json({ error: 'before timestamp is required' });
    }
    
    const messages = await getOlderMessages(roomId, beforeTimestamp, limit);
    
    // Get like counts for all messages
    const messageIds = messages.map(m => m.id);
    const likes = await getLikesForMessages(messageIds);
    
    // Add like counts to messages
    const messagesWithLikes = messages.map(msg => ({
      ...msg,
      likeCount: likes[msg.id] || 0
    }));
    
    res.json(messagesWithLikes);
  } catch (error) {
    console.error('Error fetching older messages:', error);
    res.status(500).json({ error: 'Failed to fetch older messages' });
  }
});

/**
 * @swagger
 * /api/messages/likes:
 *   post:
 *     summary: Get like counts for multiple messages
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageIds
 *             properties:
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["msg1", "msg2", "msg3"]
 *     responses:
 *       200:
 *         description: Like counts for messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *               example:
 *                 "msg1": 5
 *                 "msg2": 2
 *       400:
 *         description: messageIds array is required
 *       500:
 *         description: Failed to fetch likes
 */
// Get likes for multiple messages
app.post('/api/messages/likes', async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'messageIds array is required' });
    }
    
    const likes = await getLikesForMessages(messageIds);
    res.json(likes);
  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

/**
 * @swagger
 * /api/messages/user-likes:
 *   post:
 *     summary: Get which messages a user has liked
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageIds
 *               - userId
 *             properties:
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["msg1", "msg2", "msg3"]
 *               userId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Array of message IDs the user has liked
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["msg1", "msg3"]
 *       400:
 *         description: messageIds array and userId are required
 *       500:
 *         description: Failed to fetch user likes
 */
// Get which messages a user has liked
app.post('/api/messages/user-likes', async (req, res) => {
  try {
    const { messageIds, userId } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || !userId) {
      return res.status(400).json({ error: 'messageIds array and userId are required' });
    }
    
    const likedMessageIds = await getUserLikedMessages(messageIds, userId);
    res.json(likedMessageIds);
  } catch (error) {
    console.error('Error fetching user likes:', error);
    res.status(500).json({ error: 'Failed to fetch user likes' });
  }
});

/**
 * @swagger
 * /api/messages/{messageId}:
 *   get:
 *     summary: Get message by ID with surrounding context
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message identifier
 *       - in: query
 *         name: before
 *         schema:
 *           type: integer
 *           default: 25
 *         description: Number of messages before the target message
 *       - in: query
 *         name: after
 *         schema:
 *           type: integer
 *           default: 25
 *         description: Number of messages after the target message
 *     responses:
 *       200:
 *         description: Messages with context
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                 targetMessageId:
 *                   type: string
 *       404:
 *         description: Message not found
 *       500:
 *         description: Failed to fetch message
 */
// Get message by ID with context
app.get('/api/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const before = parseInt(req.query.before) || 25;
    const after = parseInt(req.query.after) || 25;
    
    const messages = await getMessagesAround(messageId, before, after);
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Get like counts for all messages
    const messageIds = messages.map(m => m.id);
    const likes = await getLikesForMessages(messageIds);
    
    // Add like counts to messages
    const messagesWithLikes = messages.map(msg => ({
      ...msg,
      likeCount: likes[msg.id] || 0
    }));
    
    res.json({
      messages: messagesWithLikes,
      targetMessageId: messageId
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

/**
 * @swagger
 * /api/users/{userId}/nickname:
 *   post:
 *     summary: Update user nickname
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 nullable: true
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: Nickname updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid user ID
 *       500:
 *         description: Failed to update nickname
 */
// Update user nickname
app.post('/api/users/:userId/nickname', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { nickname } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    await updateUserNickname(userId, nickname);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating nickname:', error);
    res.status(500).json({ error: 'Failed to update nickname' });
  }
});

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User identifier
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 nickname:
 *                   type: string
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to get user
 */
// Get user
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * @swagger
 * /api/messages/{messageId}/like:
 *   post:
 *     summary: Like or unlike a message
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Like status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 liked:
 *                   type: boolean
 *                 likeCount:
 *                   type: integer
 *       400:
 *         description: Valid userId is required
 *       500:
 *         description: Failed to toggle like
 */
// Like/unlike a message
app.post('/api/messages/:messageId/like', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;
    
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ error: 'Valid userId is required' });
    }
    
    const result = await toggleLike(messageId, parseInt(userId));
    const likeCount = await getLikeCount(messageId);
    
    // Broadcast like update to all clients
    io.emit('like-update', {
      messageId,
      likeCount,
      liked: result.liked
    });
    
    res.json({
      liked: result.liked,
      likeCount
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  // Use userId from client if provided, otherwise generate one
  socket.userId = null; // Will be set when first message is sent
  
  console.log(`User connected: ${socket.id}`);
  
  // Room will be set when user joins
  socket.roomId = null;
  
  // Handle user identification
  socket.on('identify', async (data) => {
    try {
      console.log('Received identify event from socket:', socket.id, 'data:', data);
      const { userId } = data || {};
      let user;
      
      if (userId !== null && userId !== undefined && !isNaN(parseInt(userId))) {
        // Use existing user ID
        console.log('Using existing userId:', userId);
        user = await getOrCreateUser(parseInt(userId));
      } else {
        // Create new user
        console.log('Creating new user');
        user = await getOrCreateUser();
      }
      
      console.log('User identified successfully:', user.id);
      socket.userId = user.id;
      socket.emit('identified', { userId: user.id, nickname: user.nickname });
    } catch (error) {
      console.error('Error identifying user:', error);
      console.error('Error stack:', error.stack);
      socket.emit('error', { message: 'Failed to identify user: ' + error.message });
    }
  });
  
  // Handle room join
  socket.on('join-room', async (data) => {
    try {
      const { roomId } = data;
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }
      
      // Check if room exists first - don't create new rooms
      const room = await getRoom(roomId);
      if (!room) {
        socket.emit('room-not-found', { roomId, message: 'Room does not exist' });
        return;
      }
      
      // Leave previous room if any
      if (socket.roomId) {
        socket.leave(socket.roomId);
      }
      
      // Join existing room
      socket.roomId = roomId;
      socket.join(roomId);
      
      // Get recent messages for this room (limit to 30 initially)
      const messages = await getRecentMessages(roomId, 30);
      const messageIds = messages.map(m => m.id);
      const likes = await getLikesForMessages(messageIds);
      
      const messagesWithLikes = messages.map(msg => ({
        ...msg,
        likeCount: likes[msg.id] || 0
      }));
      
      socket.emit('recent-messages', messagesWithLikes);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });
  
  // Handle new message
  socket.on('message', async (data) => {
    try {
      console.log('Received message event from socket:', socket.id, 'data:', data);
      console.log('Socket state - roomId:', socket.roomId, 'userId:', socket.userId);
      
      if (!socket.roomId) {
        console.error('Message rejected: socket not in a room');
        socket.emit('error', { message: 'Must join a room first' });
        return;
      }
      
      if (!socket.userId && socket.userId !== 0) {
        console.error('Message rejected: socket user not identified');
        socket.emit('error', { message: 'Must identify first' });
        return;
      }
      
      // Create message object (without username - will be joined from users table)
      const message = {
        id: require('./utils').generateUserId(),
        roomId: socket.roomId,
        userId: socket.userId,
        text: data.text || '',
        imageUrl: data.imageUrl || null,
        timestamp: new Date().toISOString()
      };
      
      console.log('Saving message:', message.id, 'to room:', message.roomId);
      
      // Save to database (only userId, not username)
      await saveMessage(message);
      
      // Get user to get nickname for broadcasting
      const user = await getUser(socket.userId);
      const displayName = user?.nickname || `User ${socket.userId}`;
      
      // Add like count (0 for new messages) and username for broadcasting
      const messageWithLikes = {
        ...message,
        username: displayName,
        likeCount: 0
      };
      
      console.log('Broadcasting message to room:', socket.roomId);
      // Broadcast to all clients in the room
      io.to(socket.roomId).emit('new-message', messageWithLikes);
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
  });
  
  // Handle typing indicator
  socket.on('typing', (data) => {
    if (!socket.userId && socket.userId !== 0) {
      return;
    }
    socket.broadcast.emit('user-typing', {
      userId: socket.userId
    });
  });
  
  socket.on('stop-typing', () => {
    if (!socket.userId && socket.userId !== 0) {
      return;
    }
    socket.broadcast.emit('user-stopped-typing', {
      userId: socket.userId
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId} (${socket.id})`);
  });
});

// Admin API key middleware
const requireAdminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Valid API key required.' });
  }
  
  next();
};

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/api/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/admin/api/messages', requireAdminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const messages = await getMessagesStats(limit);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/admin/api/rooms', requireAdminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const rooms = await getRoomsStats(limit);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.get('/admin/api/pageviews', requireAdminAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const pageViews = await getPageViewsStats(days);
    res.json(pageViews);
  } catch (error) {
    console.error('Error fetching page views:', error);
    res.status(500).json({ error: 'Failed to fetch page views' });
  }
});

app.get('/admin/api/performance', requireAdminAuth, async (req, res) => {
  try {
    const metrics = await getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

app.post('/admin/api/delete-all-data', requireAdminAuth, async (req, res) => {
  try {
    const result = await deleteAllData();
    res.json(result);
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ error: 'Failed to delete all data' });
  }
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Handle React routing with dynamic OpenGraph meta tags
  app.get('*', async (req, res) => {
    const indexPath = path.join(__dirname, '../client/build', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Default meta tags
    let ogTitle = 'Fastt Chat';
    let ogDescription = 'Fastt Chat - High-performance real-time messaging';
    let ogImage = '';
    let ogUrl = `https://${req.get('host')}${req.originalUrl}`;
    
    try {
      // Check if this is a room page
      const roomSlugMatch = req.path.match(/^\/([a-zA-Z0-9-]+)$/);
      if (roomSlugMatch && roomSlugMatch[1] !== 'favicon.ico') {
        const roomSlug = roomSlugMatch[1];
        const room = await getRoom(roomSlug);
        if (room) {
          ogTitle = `${room.title || room.slug} - Fastt Chat`;
        }
      }
      
      // Check if this is a shared message
      const messageId = req.query.msg;
      if (messageId) {
        const message = await getMessageById(messageId);
        if (message) {
          if (message.imageUrl) {
            ogImage = `https://${req.get('host')}${message.imageUrl}`;
          }
        }
      }
    } catch (error) {
      console.error('Error generating meta tags:', error);
    }
    
    // Inject meta tags into HTML
    const metaTags = `
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${ogUrl}" />
    ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
    ${ogImage ? `<meta property="og:image:width" content="1200" />` : ''}
    ${ogImage ? `<meta property="og:image:height" content="630" />` : ''}
    <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDescription}" />
    ${ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : ''}
    <title>${ogTitle}</title>`;
    
    // Replace the title and description in head
    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace('</head>', `${metaTags}</head>`);
    
    res.send(html);
  });
} else {
  // In development, serve static files
  const clientBuildPath = path.join(__dirname, '../client/build');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    app.get('*', async (req, res) => {
      const indexPath = path.join(clientBuildPath, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');
      
      // Default meta tags
      let ogTitle = 'Fastt Chat';
      let ogDescription = 'Fastt Chat - High-performance real-time messaging';
      let ogImage = '';
      let ogUrl = `http://${req.get('host')}${req.originalUrl}`;
      
      try {
        // Check if this is a room page
        const roomSlugMatch = req.path.match(/^\/([a-zA-Z0-9-]+)$/);
        if (roomSlugMatch && roomSlugMatch[1] !== 'favicon.ico') {
          const roomSlug = roomSlugMatch[1];
          const room = await getRoom(roomSlug);
          if (room) {
            ogTitle = `${room.title || room.slug} - Fastt Chat`;
          }
        }
        
        // Check if this is a shared message
        const messageId = req.query.msg;
        if (messageId) {
          const message = await getMessageById(messageId);
          if (message) {
            if (message.imageUrl) {
              ogImage = `http://${req.get('host')}${message.imageUrl}`;
            }
          }
        }
      } catch (error) {
        console.error('Error generating meta tags:', error);
      }
      
      // Inject meta tags into HTML
      const metaTags = `
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${ogUrl}" />
    ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
    ${ogImage ? `<meta property="og:image:width" content="1200" />` : ''}
    ${ogImage ? `<meta property="og:image:height" content="630" />` : ''}
    <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDescription}" />
    ${ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : ''}
    <title>${ogTitle}</title>`;
      
      // Replace the title and description in head
      html = html.replace(/<title>.*?<\/title>/, '');
      html = html.replace(/<meta name="description"[^>]*>/, '');
      html = html.replace('</head>', `${metaTags}</head>`);
      
      res.send(html);
    });
  }
}

// Initialize database and start server
initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Fastt Chat Server running on port ${PORT}`);
    console.log(`WebSocket server ready for high-throughput messaging`);
    const networkInterfaces = os.networkInterfaces();
    const ip = Object.values(networkInterfaces)
      .flat()
      .find(iface => iface.family === 'IPv4' && !iface.internal)?.address;
    if (ip) {
      console.log(`Access from your phone at: http://${ip}:3000`);
    }
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

