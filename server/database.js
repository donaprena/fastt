const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'chat.db');
let db = null;

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      // Create messages table with optimized indexes
      db.serialize(() => {
        // Create users table first
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            nickname TEXT,
            createdAt TEXT NOT NULL
          )
        `, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
            return;
          }
          
          // Create rooms table
          db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
              slug TEXT PRIMARY KEY,
              title TEXT,
              createdAt TEXT NOT NULL,
              lastMessageAt TEXT,
              isPublic INTEGER DEFAULT 1
            )
          `, (err) => {
            if (err) {
              console.error('Error creating rooms table:', err);
              reject(err);
              return;
            }
            
            // Add isPublic column if it doesn't exist (migration)
            db.run(`
              ALTER TABLE rooms ADD COLUMN isPublic INTEGER DEFAULT 1
            `, (err) => {
              // Ignore error if column already exists
              if (err && !err.message.includes('duplicate column')) {
                console.log('Note: Could not add isPublic column (might already exist)');
              }
              // Add creatorId column if it doesn't exist (migration)
              db.run(`
                ALTER TABLE rooms ADD COLUMN creatorId INTEGER
              `, (err) => {
                // Ignore error if column already exists
                if (err) {
                  if (err.message && (err.message.includes('duplicate column') || err.message.includes('duplicate column name'))) {
                    console.log('creatorId column already exists');
                  } else {
                    console.log('Note: Could not add creatorId column:', err.message);
                  }
                } else {
                  console.log('Successfully added creatorId column to rooms table');
                }
                // Create messages table with correct schema
                createMessagesTable();
              });
            });
          });
        });
        
        function createMessagesTable() {
          // Check if messages table exists and if it has username column
          db.all(`PRAGMA table_info(messages)`, (err, columns) => {
            if (err || !columns || columns.length === 0) {
              // Table doesn't exist, create it
              db.run(`
                CREATE TABLE messages (
                  id TEXT PRIMARY KEY,
                  roomId TEXT NOT NULL DEFAULT 'default',
                  userId INTEGER NOT NULL,
                  text TEXT,
                  imageUrl TEXT,
                  timestamp TEXT NOT NULL
                )
              `, (err) => {
                if (err) {
                  console.error('Error creating messages table:', err);
                  reject(err);
                  return;
                }
                createLikesTable();
              });
            } else {
              // Table exists, check if it has username column
              const hasUsernameColumn = columns.some(col => col.name === 'username');
              if (hasUsernameColumn) {
                // Migrate: create new table without username
                console.log('Migrating messages table to remove username column...');
                db.run(`
                  CREATE TABLE messages_new (
                    id TEXT PRIMARY KEY,
                    roomId TEXT NOT NULL DEFAULT 'default',
                    userId INTEGER NOT NULL,
                    text TEXT,
                    imageUrl TEXT,
                    timestamp TEXT NOT NULL
                  )
                `, (err) => {
                  if (err) {
                    console.error('Error creating new messages table:', err);
                    reject(err);
                    return;
                  }
                  // Copy data excluding username
                  db.run(`
                    INSERT INTO messages_new 
                    SELECT id, roomId, userId, text, imageUrl, timestamp FROM messages
                  `, (err) => {
                    if (err) {
                      console.error('Error copying messages:', err);
                      reject(err);
                      return;
                    }
                    // Drop old table and rename new one
                    db.run(`DROP TABLE messages`, (err) => {
                      if (err) {
                        console.error('Error dropping old messages table:', err);
                        reject(err);
                        return;
                      }
                      db.run(`ALTER TABLE messages_new RENAME TO messages`, (err) => {
                        if (err) {
                          console.error('Error renaming messages table:', err);
                          reject(err);
                          return;
                        }
                        console.log('Successfully migrated messages table');
                        createLikesTable();
                      });
                    });
                  });
                });
              } else {
                // Table exists without username, just proceed
                createLikesTable();
              }
            }
          });
        }
        
        function createLikesTable() {
          // Try to change userId column type in likes table
          db.run(`
            ALTER TABLE likes ADD COLUMN userId_new INTEGER
          `, (err) => {
            if (!err) {
              db.run(`
                UPDATE likes SET userId_new = CAST(userId AS INTEGER) WHERE typeof(userId) = 'text' AND userId GLOB '[0-9]*'
              `, () => {
                db.run(`
                  CREATE TABLE IF NOT EXISTS likes_new (
                    messageId TEXT NOT NULL,
                    userId INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    PRIMARY KEY (messageId, userId),
                    FOREIGN KEY (messageId) REFERENCES messages(id)
                  )
                `, () => {
                  db.run(`
                    INSERT OR IGNORE INTO likes_new SELECT messageId, COALESCE(userId_new, 0), timestamp FROM likes
                  `, () => {
                    db.run(`DROP TABLE likes`, () => {
                      db.run(`ALTER TABLE likes_new RENAME TO likes`, () => {
                        createIndexes();
                      });
                    });
                  });
                });
              });
            } else {
              createLikesTableDirect();
            }
          });
        }
        
        function createLikesTableDirect() {
          db.run(`
            CREATE TABLE IF NOT EXISTS likes (
              messageId TEXT NOT NULL,
              userId INTEGER NOT NULL,
              timestamp TEXT NOT NULL,
              PRIMARY KEY (messageId, userId),
              FOREIGN KEY (messageId) REFERENCES messages(id)
            )
          `, (err) => {
            if (err) {
              console.error('Error creating likes table:', err);
              reject(err);
              return;
            }
            createIndexes();
          });
        }
        
        function createIndexes() {
          db.run(`
            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON messages(timestamp DESC)
          `, (err) => {
            if (err) {
              console.error('Error creating timestamp index:', err);
              reject(err);
              return;
            }
            
            db.run(`
              CREATE INDEX IF NOT EXISTS idx_roomId 
              ON messages(roomId)
            `, (err) => {
              if (err) {
                console.error('Error creating roomId index:', err);
                reject(err);
                return;
              }
              
              db.run(`
                CREATE INDEX IF NOT EXISTS idx_userId 
                ON messages(userId)
              `, (err) => {
                if (err) {
                  console.error('Error creating userId index:', err);
                  reject(err);
                  return;
                }
                
                // Create page_views table for admin analytics
                db.run(`
                  CREATE TABLE IF NOT EXISTS page_views (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    userAgent TEXT,
                    ip TEXT
                  )
                `, (err) => {
                  if (err) {
                    console.error('Error creating page_views table:', err);
                  }
                  
                  // Create index on timestamp for faster queries
                  db.run(`
                    CREATE INDEX IF NOT EXISTS idx_page_views_timestamp 
                    ON page_views(timestamp DESC)
                  `, (err) => {
                    if (err) {
                      console.error('Error creating page_views index:', err);
                    }
                    
                    console.log('Database initialized successfully');
                    resolve();
                  });
                });
              });
            });
          });
        }
      });
    });
  });
}

// Save message to database
function saveMessage(message) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO messages (id, roomId, userId, text, imageUrl, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      message.id,
      message.roomId || 'default',
      message.userId,
      message.text || null,
      message.imageUrl || null,
      message.timestamp
    ], function(err) {
      if (err) {
        console.error('Error saving message:', err);
        reject(err);
      } else {
        // Update room's lastMessageAt
        updateRoomLastMessage(message.roomId || 'default');
        resolve();
      }
      stmt.finalize();
    });
  });
}

// Get recent messages (optimized query)
function getRecentMessages(roomId, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        m.id,
        m.roomId,
        m.userId,
        m.text,
        m.imageUrl,
        m.timestamp,
        u.nickname as username
      FROM messages m
      LEFT JOIN users u ON m.userId = u.id
      WHERE m.roomId = ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `, [roomId || 'default', limit], (err, rows) => {
      if (err) {
        console.error('Error fetching messages:', err);
        reject(err);
      } else {
        // Reverse to show oldest first
        resolve(rows.reverse());
      }
    });
  });
}

// Get older messages (before a specific timestamp)
function getOlderMessages(roomId, beforeTimestamp, limit = 30) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        m.id,
        m.roomId,
        m.userId,
        m.text,
        m.imageUrl,
        m.timestamp,
        u.nickname as username
      FROM messages m
      LEFT JOIN users u ON m.userId = u.id
      WHERE m.roomId = ? AND m.timestamp < ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `, [roomId || 'default', beforeTimestamp, limit], (err, rows) => {
      if (err) {
        console.error('Error fetching older messages:', err);
        reject(err);
      } else {
        // Reverse to show oldest first
        resolve(rows.reverse());
      }
    });
  });
}

// Get message by ID
function getMessageById(messageId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        m.id,
        m.roomId,
        m.userId,
        m.text,
        m.imageUrl,
        m.timestamp,
        u.nickname as username
      FROM messages m
      LEFT JOIN users u ON m.userId = u.id
      WHERE m.id = ?
    `, [messageId], (err, row) => {
      if (err) {
        console.error('Error fetching message:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Get messages around a specific message ID (for context)
function getMessagesAround(messageId, before = 25, after = 25) {
  return new Promise((resolve, reject) => {
    // First get the target message to find its timestamp
    getMessageById(messageId).then(targetMessage => {
      if (!targetMessage) {
        resolve([]);
        return;
      }
      
      const roomId = targetMessage.roomId || 'default';
      
      // Get messages before and after the target message in the same room
      db.all(`
        SELECT 
          m.id,
          m.roomId,
          m.userId,
          m.text,
          m.imageUrl,
          m.timestamp,
          u.nickname as username
        FROM messages m
        LEFT JOIN users u ON m.userId = u.id
        WHERE m.roomId = ? AND m.timestamp <= ?
        ORDER BY m.timestamp DESC
        LIMIT ?
      `, [roomId, targetMessage.timestamp, before + 1], (err, beforeRows) => {
        if (err) {
          console.error('Error fetching messages before:', err);
          reject(err);
          return;
        }
        
        db.all(`
          SELECT 
            m.id,
            m.roomId,
            m.userId,
            m.text,
            m.imageUrl,
            m.timestamp,
            u.nickname as username
          FROM messages m
          LEFT JOIN users u ON m.userId = u.id
          WHERE m.roomId = ? AND m.timestamp > ?
          ORDER BY m.timestamp ASC
          LIMIT ?
        `, [roomId, targetMessage.timestamp, after], (err, afterRows) => {
          if (err) {
            console.error('Error fetching messages after:', err);
            reject(err);
            return;
          }
          
          // Combine and sort: reverse beforeRows, add target, add afterRows
          const allMessages = [
            ...beforeRows.reverse(),
            ...afterRows
          ];
          
          // Remove duplicates and ensure target is included
          const messageMap = new Map();
          allMessages.forEach(msg => messageMap.set(msg.id, msg));
          messageMap.set(targetMessage.id, targetMessage);
          
          const result = Array.from(messageMap.values()).sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );
          
          resolve(result);
        });
      });
    }).catch(reject);
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// Toggle like on a message
function toggleLike(messageId, userId) {
  return new Promise((resolve, reject) => {
    // First check if like exists
    db.get(`
      SELECT * FROM likes
      WHERE messageId = ? AND userId = ?
    `, [messageId, userId], (err, row) => {
      if (err) {
        console.error('Error checking like:', err);
        reject(err);
        return;
      }
      
      if (row) {
        // Unlike - remove the like
        db.run(`
          DELETE FROM likes
          WHERE messageId = ? AND userId = ?
        `, [messageId, userId], function(err) {
          if (err) {
            console.error('Error removing like:', err);
            reject(err);
          } else {
            resolve({ liked: false, likeCount: this.changes });
          }
        });
      } else {
        // Like - add the like
        db.run(`
          INSERT INTO likes (messageId, userId, timestamp)
          VALUES (?, ?, ?)
        `, [messageId, userId, new Date().toISOString()], function(err) {
          if (err) {
            console.error('Error adding like:', err);
            reject(err);
          } else {
            resolve({ liked: true, likeCount: this.changes });
          }
        });
      }
    });
  });
}

// Get like count for a message
function getLikeCount(messageId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT COUNT(*) as count FROM likes
      WHERE messageId = ?
    `, [messageId], (err, row) => {
      if (err) {
        console.error('Error getting like count:', err);
        reject(err);
      } else {
        resolve(row ? row.count : 0);
      }
    });
  });
}

// Check if user liked a message
function userLikedMessage(messageId, userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM likes
      WHERE messageId = ? AND userId = ?
    `, [messageId, userId], (err, row) => {
      if (err) {
        console.error('Error checking user like:', err);
        reject(err);
      } else {
        resolve(!!row);
      }
    });
  });
}

// Get all likes for messages (batch)
function getLikesForMessages(messageIds) {
  return new Promise((resolve, reject) => {
    if (!messageIds || messageIds.length === 0) {
      resolve({});
      return;
    }
    
    const placeholders = messageIds.map(() => '?').join(',');
    db.all(`
      SELECT messageId, COUNT(*) as count
      FROM likes
      WHERE messageId IN (${placeholders})
      GROUP BY messageId
    `, messageIds, (err, rows) => {
      if (err) {
        console.error('Error getting likes:', err);
        reject(err);
      } else {
        const result = {};
        rows.forEach(row => {
          result[row.messageId] = row.count;
        });
        resolve(result);
      }
    });
  });
}

// Get message IDs that a user has liked
function getUserLikedMessages(messageIds, userId) {
  return new Promise((resolve, reject) => {
    if (!messageIds || messageIds.length === 0) {
      resolve([]);
      return;
    }
    
    const userIdInt = parseInt(userId);
    const placeholders = messageIds.map(() => '?').join(',');
    db.all(`
      SELECT messageId FROM likes
      WHERE messageId IN (${placeholders}) AND userId = ?
    `, [...messageIds, userIdInt], (err, rows) => {
      if (err) {
        console.error('Error getting user liked messages:', err);
        reject(err);
      } else {
        resolve(rows.map(r => r.messageId));
      }
    });
  });
}

// Room management functions
function createRoom(slug, title = null, isPublic = true, creatorId = null) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    // First check if room exists
    db.get(`
      SELECT * FROM rooms WHERE slug = ?
    `, [slug], (err, existingRoom) => {
      if (err) {
        console.error('Error checking room:', err);
        reject(err);
        return;
      }
      
      if (existingRoom) {
        // Room already exists, return it
        resolve(existingRoom);
        return;
      }
      
      // Create new room
      const isPublicInt = isPublic ? 1 : 0;
      
      // Try INSERT with creatorId first, fallback to without creatorId if column doesn't exist
      db.run(`
        INSERT INTO rooms (slug, title, createdAt, lastMessageAt, isPublic, creatorId)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [slug, title || slug, now, now, isPublicInt, creatorId], function(err) {
        if (err && err.message && err.message.includes('no such column: creatorId')) {
          // Column doesn't exist, try without creatorId
          console.log('creatorId column not found, inserting without it...');
          db.run(`
            INSERT INTO rooms (slug, title, createdAt, lastMessageAt, isPublic)
            VALUES (?, ?, ?, ?, ?)
          `, [slug, title || slug, now, now, isPublicInt], function(err2) {
            if (err2) {
              console.error('Error creating room (without creatorId):', err2);
              console.error('Error message:', err2.message);
              reject(err2);
            } else {
              resolve({ slug, title: title || slug, createdAt: now, lastMessageAt: now, isPublic: isPublic });
            }
          });
        } else if (err) {
          console.error('Error creating room:', err);
          console.error('Error message:', err.message);
          console.error('Error code:', err.code);
          reject(err);
        } else {
          resolve({ slug, title: title || slug, createdAt: now, lastMessageAt: now, isPublic: isPublic, creatorId: creatorId });
        }
      });
    });
  });
}

function getRoom(slug) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM rooms WHERE slug = ?
    `, [slug], (err, row) => {
      if (err) {
        console.error('Error fetching room:', err);
        reject(err);
      } else {
        if (row) {
          // Convert isPublic from integer to boolean
          row.isPublic = row.isPublic === 1 || row.isPublic === null;
        }
        resolve(row);
      }
    });
  });
}

function getAllRooms(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM rooms
      WHERE isPublic = 1
      ORDER BY lastMessageAt DESC, createdAt DESC
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) {
        console.error('Error fetching rooms:', err);
        reject(err);
      } else {
        // Convert isPublic from integer to boolean
        const rooms = (rows || []).map(room => ({
          ...room,
          isPublic: room.isPublic === 1 || room.isPublic === null
        }));
        resolve(rooms);
      }
    });
  });
}

function getUserRooms(userId, limit = 50) {
  return new Promise((resolve, reject) => {
    if (!userId) {
      // If no userId, return empty array
      resolve([]);
      return;
    }
    
    const userIdInt = parseInt(userId);
    // Get rooms where user is creator OR has sent messages
    db.all(`
      SELECT DISTINCT r.* FROM rooms r
      LEFT JOIN messages m ON r.slug = m.roomId
      WHERE r.creatorId = ? OR m.userId = ?
      ORDER BY r.lastMessageAt DESC, r.createdAt DESC
      LIMIT ?
    `, [userIdInt, userIdInt, limit], (err, rows) => {
      if (err) {
        console.error('Error fetching user rooms:', err);
        reject(err);
      } else {
        // Convert isPublic from integer to boolean
        const rooms = (rows || []).map(room => ({
          ...room,
          isPublic: room.isPublic === 1 || room.isPublic === null
        }));
        resolve(rooms);
      }
    });
  });
}

function updateRoomLastMessage(roomId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(`
      UPDATE rooms SET lastMessageAt = ? WHERE slug = ?
    `, [now, roomId], (err) => {
      if (err && !err.message.includes('no such table')) {
        // Ignore if rooms table doesn't exist yet (for migration)
        console.log('Note: Could not update room lastMessageAt');
      }
      resolve();
    });
  });
}

function updateRoomTitle(slug, newTitle) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE rooms SET title = ? WHERE slug = ?
    `, [newTitle, slug], function(err) {
      if (err) {
        console.error('Error updating room title:', err);
        reject(err);
      } else {
        if (this.changes === 0) {
          reject(new Error('Room not found'));
        } else {
          resolve({ success: true });
        }
      }
    });
  });
}

function deleteRoom(slug) {
  return new Promise((resolve, reject) => {
    // Delete messages first (due to foreign key constraints in likes)
    db.run(`
      DELETE FROM messages WHERE roomId = ?
    `, [slug], (err) => {
      if (err) {
        console.error('Error deleting messages:', err);
        reject(err);
        return;
      }
      
      // Delete room
      db.run(`
        DELETE FROM rooms WHERE slug = ?
      `, [slug], function(err) {
        if (err) {
          console.error('Error deleting room:', err);
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Room not found'));
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  });
}

// User management functions
function getOrCreateUser(userId = null) {
  return new Promise((resolve, reject) => {
    if (userId !== null && userId !== undefined) {
      // Get existing user
      db.get(`
        SELECT * FROM users WHERE id = ?
      `, [userId], (err, row) => {
        if (err) {
          console.error('Error getting user:', err);
          reject(err);
        } else if (row) {
          resolve(row);
        } else {
          // User doesn't exist, create new one with this ID
          // Use INSERT OR IGNORE to handle race conditions
          const now = new Date().toISOString();
          db.run(`
            INSERT OR IGNORE INTO users (id, nickname, createdAt)
            VALUES (?, ?, ?)
          `, [userId, null, now], function(err) {
            if (err) {
              console.error('Error creating user:', err);
              reject(err);
            } else if (this.changes === 0) {
              // No rows inserted (likely due to race condition), fetch the existing user
              console.log(`User ${userId} was created by another request, fetching...`);
              db.get(`
                SELECT * FROM users WHERE id = ?
              `, [userId], (err, row) => {
                if (err || !row) {
                  reject(new Error('Failed to create or fetch user'));
                } else {
                  resolve(row);
                }
              });
            } else {
              resolve({ id: userId, nickname: null, createdAt: now });
            }
          });
        }
      });
    } else {
      // Create new user - use timestamp-based ID to avoid race conditions
      const attemptCreateUser = (attempt = 0, maxAttempts = 10) => {
        if (attempt >= maxAttempts) {
          reject(new Error('Failed to create user after multiple attempts'));
          return;
        }
        
        // Generate ID using timestamp + random number to avoid collisions
        // Timestamp in milliseconds gives us ~13 digits, add 3 random digits
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000); // 0-999
        const newUserId = timestamp * 1000 + random; // Combine into single number
        
        const now = new Date().toISOString();
        console.log(`Creating new user with ID: ${newUserId} (attempt ${attempt + 1})`);
        
        // Use INSERT OR IGNORE to handle rare collisions gracefully
        db.run(`
          INSERT OR IGNORE INTO users (id, nickname, createdAt)
          VALUES (?, ?, ?)
        `, [newUserId, null, now], function(err) {
          if (err) {
            // Database error - retry with new ID (could be locked database, etc.)
            console.error('Error creating user with ID', newUserId, ':', err);
            console.error('Error message:', err.message);
            console.error('Error code:', err.code);
            if (attempt + 1 < maxAttempts) {
              console.log('Retrying with new ID due to error...');
              setTimeout(() => {
                attemptCreateUser(attempt + 1, maxAttempts);
              }, 10 + Math.random() * 50);
            } else {
              reject(err);
            }
          } else if (this.changes === 0) {
            // INSERT OR IGNORE with 0 changes means the ID already exists (extremely rare)
            console.log(`User ID ${newUserId} already exists (collision), retrying with new ID...`);
            // Very short delay and retry with new timestamp-based ID
            setTimeout(() => {
              attemptCreateUser(attempt + 1, maxAttempts);
            }, 1 + Math.random() * 5);
          } else {
            console.log('Successfully created new user with ID:', newUserId);
            resolve({ id: newUserId, nickname: null, createdAt: now });
          }
        });
      };
      
      attemptCreateUser();
    }
  });
}

function updateUserNickname(userId, nickname) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE users SET nickname = ? WHERE id = ?
    `, [nickname || null, userId], function(err) {
      if (err) {
        console.error('Error updating user nickname:', err);
        reject(err);
      } else {
        resolve({ success: true });
      }
    });
  });
}

function getUser(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM users WHERE id = ?
    `, [userId], (err, row) => {
      if (err) {
        console.error('Error getting user:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Page view tracking
function trackPageView(path, userAgent, ip) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(`
      INSERT INTO page_views (path, timestamp, userAgent, ip)
      VALUES (?, ?, ?, ?)
    `, [path, timestamp, userAgent || null, ip || null], function(err) {
      if (err) {
        console.error('Error tracking page view:', err);
        reject(err);
      } else {
        resolve({ id: this.lastID });
      }
    });
  });
}

// Admin statistics functions
function getAdminStats() {
  return new Promise((resolve, reject) => {
    Promise.all([
      // Total users
      new Promise((res, rej) => {
        db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Total rooms
      new Promise((res, rej) => {
        db.get(`SELECT COUNT(*) as count FROM rooms`, (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Total messages
      new Promise((res, rej) => {
        db.get(`SELECT COUNT(*) as count FROM messages`, (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Total likes
      new Promise((res, rej) => {
        db.get(`SELECT COUNT(*) as count FROM likes`, (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Total page views
      new Promise((res, rej) => {
        db.get(`SELECT COUNT(*) as count FROM page_views`, (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Messages today
      new Promise((res, rej) => {
        const today = new Date().toISOString().split('T')[0];
        db.get(`SELECT COUNT(*) as count FROM messages WHERE date(timestamp) = date(?)`, [today], (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Active users (users who sent messages) in last 7 days
      new Promise((res, rej) => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        db.get(`
          SELECT COUNT(DISTINCT userId) as count 
          FROM messages 
          WHERE timestamp > ?
        `, [sevenDaysAgo], (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      }),
      // Page views today
      new Promise((res, rej) => {
        const today = new Date().toISOString().split('T')[0];
        db.get(`SELECT COUNT(*) as count FROM page_views WHERE date(timestamp) = date(?)`, [today], (err, row) => {
          if (err) rej(err);
          else res(row.count);
        });
      })
    ]).then(([totalUsers, totalRooms, totalMessages, totalLikes, totalPageViews, messagesToday, activeUsers, pageViewsToday]) => {
      resolve({
        totalUsers,
        totalRooms,
        totalMessages,
        totalLikes,
        totalPageViews,
        messagesToday,
        activeUsers,
        pageViewsToday
      });
    }).catch(reject);
  });
}

function getMessagesStats(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        m.id,
        m.roomId,
        m.userId,
        m.text,
        m.imageUrl,
        m.timestamp,
        u.nickname as username,
        (SELECT COUNT(*) FROM likes WHERE messageId = m.id) as likeCount
      FROM messages m
      LEFT JOIN users u ON m.userId = u.id
      ORDER BY m.timestamp DESC
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) {
        console.error('Error fetching messages stats:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getRoomsStats(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM messages WHERE roomId = r.slug) as messageCount,
        (SELECT COUNT(DISTINCT userId) FROM messages WHERE roomId = r.slug) as userCount
      FROM rooms r
      ORDER BY r.lastMessageAt DESC, r.createdAt DESC
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) {
        console.error('Error fetching rooms stats:', err);
        reject(err);
      } else {
        // Convert isPublic from integer to boolean
        const rooms = (rows || []).map(room => ({
          ...room,
          isPublic: room.isPublic === 1 || room.isPublic === null
        }));
        resolve(rooms);
      }
    });
  });
}

function getPageViewsStats(days = 7) {
  return new Promise((resolve, reject) => {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    db.all(`
      SELECT 
        date(timestamp) as date,
        COUNT(*) as count,
        COUNT(DISTINCT path) as uniquePaths
      FROM page_views
      WHERE timestamp > ?
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `, [startDate], (err, rows) => {
      if (err) {
        console.error('Error fetching page views stats:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getPerformanceMetrics() {
  return new Promise((resolve, reject) => {
    Promise.all([
      // Messages per day (last 7 days)
      new Promise((res, rej) => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        db.all(`
          SELECT 
            date(timestamp) as date,
            COUNT(*) as count
          FROM messages
          WHERE timestamp > ?
          GROUP BY date(timestamp)
          ORDER BY date DESC
        `, [sevenDaysAgo], (err, rows) => {
          if (err) rej(err);
          else res(rows);
        });
      }),
      // Most active rooms
      new Promise((res, rej) => {
        db.all(`
          SELECT 
            r.slug,
            r.title,
            COUNT(m.id) as messageCount,
            COUNT(DISTINCT m.userId) as userCount,
            MAX(m.timestamp) as lastMessageAt
          FROM rooms r
          LEFT JOIN messages m ON r.slug = m.roomId
          GROUP BY r.slug, r.title
          ORDER BY messageCount DESC
          LIMIT 10
        `, (err, rows) => {
          if (err) rej(err);
          else res(rows);
        });
      }),
      // Most active users
      new Promise((res, rej) => {
        db.all(`
          SELECT 
            u.id,
            u.nickname,
            COUNT(m.id) as messageCount,
            MAX(m.timestamp) as lastMessageAt
          FROM users u
          LEFT JOIN messages m ON u.id = m.userId
          GROUP BY u.id, u.nickname
          HAVING messageCount > 0
          ORDER BY messageCount DESC
          LIMIT 10
        `, (err, rows) => {
          if (err) rej(err);
          else res(rows);
        });
      })
    ]).then(([messagesPerDay, topRooms, topUsers]) => {
      resolve({
        messagesPerDay,
        topRooms,
        topUsers
      });
    }).catch(reject);
  });
}

module.exports = {
  initDatabase,
  saveMessage,
  getRecentMessages,
  getOlderMessages,
  getMessageById,
  getMessagesAround,
  toggleLike,
  getLikeCount,
  userLikedMessage,
  getLikesForMessages,
  getUserLikedMessages,
  createRoom,
  getRoom,
  getAllRooms,
  getUserRooms,
  updateRoomLastMessage,
  updateRoomTitle,
  deleteRoom,
  getOrCreateUser,
  updateUserNickname,
  getUser,
  trackPageView,
  getAdminStats,
  getMessagesStats,
  getRoomsStats,
  getPageViewsStats,
  getPerformanceMetrics,
  closeDatabase
};

