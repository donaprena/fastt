const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function generateUserId() {
  // Generate UUID for message IDs (not user IDs)
  return uuidv4();
}

function generateRoomSlug() {
  // Generate a short hash-based slug (8 characters)
  const randomBytes = crypto.randomBytes(4);
  return randomBytes.toString('hex');
}

module.exports = {
  generateUserId,
  generateRoomSlug
};

