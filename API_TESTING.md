# API Testing Guide

## Swagger Documentation

Swagger API documentation is now available at:
- **URL**: `http://localhost:3001/api/docs`
- Access this in your browser to see interactive API documentation for all endpoints

## Running API Tests

To test all API endpoints, run:

```bash
npm run test-api
```

Or manually:

```bash
node test-api.js
```

You can also specify a custom API URL:

```bash
API_URL=http://your-server:3001 node test-api.js
```

## API Endpoints

All endpoints are documented in Swagger at `/api/docs`. Here's a quick overview:

### Rooms
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:slug` - Get room by slug

### Messages
- `GET /api/rooms/:roomId/messages` - Get recent messages for a room
- `GET /api/messages/:messageId` - Get message by ID with context
- `POST /api/messages/likes` - Get like counts for multiple messages
- `POST /api/messages/user-likes` - Get which messages a user has liked
- `POST /api/messages/:messageId/like` - Like/unlike a message

### Users
- `GET /api/users/:userId` - Get user by ID
- `POST /api/users/:userId/nickname` - Update user nickname

### Files
- `POST /api/upload` - Upload an image file

## Fixes Applied

1. **Fixed missing import**: Added `getLikeCount` to the database imports in `server/index.js`
2. **Fixed socket connection**: Updated client to properly reconnect when room changes
3. **Added Swagger documentation**: All endpoints are now documented at `/api/docs`
4. **Created test script**: Comprehensive test script to verify all endpoints work

## Troubleshooting

### Cannot send messages
- Ensure the server is running on port 3001
- Check browser console for socket connection errors
- Verify the user is identified (check for 'identified' event)
- Ensure you've joined a room (check for 'join-room' event)

### Cannot change nickname
- Ensure the user ID is set (check localStorage/cookies for `chat_user_id`)
- Check browser console for API errors
- Verify the endpoint is accessible: `POST /api/users/:userId/nickname`

## Testing Checklist

- [ ] Server starts without errors
- [ ] Swagger docs accessible at `/api/docs`
- [ ] All REST endpoints respond correctly
- [ ] Socket.io connection works
- [ ] Can send messages via socket
- [ ] Can update nickname via REST API
- [ ] Image upload works
- [ ] Like/unlike messages works

