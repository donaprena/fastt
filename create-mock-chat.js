const { initDatabase, createRoom, getOrCreateUser, saveMessage } = require('./server/database');
const { generateUserId, generateRoomSlug } = require('./server/utils');

// Sample messages for a mock conversation
const mockMessages = [
  "Hey everyone! Welcome to the test chat! 🎉",
  "This is a test message to see how pagination works",
  "We're going to add a lot of messages here",
  "So we can test scrolling up to load older messages",
  "Message number 5",
  "Message number 6",
  "Message number 7",
  "Message number 8",
  "Message number 9",
  "Message number 10",
  "This is getting interesting!",
  "We need at least 30+ messages to test pagination",
  "Let's keep going!",
  "Message 14",
  "Message 15",
  "Message 16",
  "Message 17",
  "Message 18",
  "Message 19",
  "Message 20 - halfway there!",
  "Message 21",
  "Message 22",
  "Message 23",
  "Message 24",
  "Message 25",
  "Message 26",
  "Message 27",
  "Message 28",
  "Message 29",
  "Message 30 - this should be in the initial load",
  "Message 31 - this should require scrolling up",
  "Message 32",
  "Message 33",
  "Message 34",
  "Message 35",
  "Message 36",
  "Message 37",
  "Message 38",
  "Message 39",
  "Message 40",
  "Message 41",
  "Message 42",
  "Message 43",
  "Message 44",
  "Message 45",
  "Message 46",
  "Message 47",
  "Message 48",
  "Message 49",
  "Message 50 - final message!",
  "Actually, let's add a few more",
  "Message 52",
  "Message 53",
  "Message 54",
  "Message 55",
  "Message 56",
  "Message 57",
  "Message 58",
  "Message 59",
  "Message 60 - okay, that's enough! 😄"
];

async function createMockChat() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    console.log('Creating test users...');
    const user1 = await getOrCreateUser();
    const user2 = await getOrCreateUser();
    const user3 = await getOrCreateUser();
    
    console.log(`Created users: ${user1.id}, ${user2.id}, ${user3.id}`);
    
    console.log('Creating test room...');
    const roomSlug = generateRoomSlug();
    const room = await createRoom(
      roomSlug,
      'Test Chat - Pagination Demo',
      true,
      user1.id
    );
    
    console.log(`Created room: ${room.slug} (${room.title})`);
    
    console.log('Adding messages...');
    const users = [user1, user2, user3];
    const now = Date.now();
    
    // Create messages with timestamps spread over the last hour
    // (older messages first, newer messages last)
    for (let i = 0; i < mockMessages.length; i++) {
      // Spread messages over the last hour (3600000 ms)
      // Older messages have earlier timestamps
      const hoursAgo = (mockMessages.length - i - 1) / mockMessages.length;
      const timestamp = new Date(now - (hoursAgo * 3600000)).toISOString();
      
      // Alternate between users
      const user = users[i % users.length];
      
      const message = {
        id: generateUserId(),
        roomId: room.slug,
        userId: user.id,
        text: mockMessages[i],
        timestamp: timestamp
      };
      
      await saveMessage(message);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  Added ${i + 1}/${mockMessages.length} messages...`);
      }
    }
    
    console.log(`\n✅ Successfully created mock chat!`);
    console.log(`\nRoom URL: http://localhost:3000/${room.slug}`);
    console.log(`Total messages: ${mockMessages.length}`);
    console.log(`\nThe chat should show the 30 most recent messages initially.`);
    console.log(`Scroll up to load older messages!`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating mock chat:', error);
    process.exit(1);
  }
}

createMockChat();

