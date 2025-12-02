const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3001';

// Test results storage
const results = {
  passed: [],
  failed: [],
  errors: []
};

// Helper function to log test results
function logTest(name, passed, error = null) {
  if (passed) {
    console.log(`✓ ${name}`);
    results.passed.push(name);
  } else {
    console.error(`✗ ${name}`);
    if (error) {
      console.error(`  Error: ${error.message || error}`);
      results.errors.push({ name, error: error.message || error });
    }
    results.failed.push(name);
  }
}

// Helper to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAllEndpoints() {
  console.log('Starting API endpoint tests...\n');
  console.log(`API URL: ${API_URL}\n`);

  let testUserId = null;
  let testRoomSlug = null;
  let testMessageId = null;

  try {
    // Test 1: Get all rooms
    try {
      const response = await axios.get(`${API_URL}/api/rooms`);
      logTest('GET /api/rooms', response.status === 200, null);
      if (response.data && response.data.length > 0) {
        testRoomSlug = response.data[0].slug;
        console.log(`  Found existing room: ${testRoomSlug}`);
      }
    } catch (error) {
      logTest('GET /api/rooms', false, error);
    }

    // Test 2: Create a new room
    try {
      const response = await axios.post(`${API_URL}/api/rooms`, {
        title: 'Test Room ' + Date.now()
      });
      logTest('POST /api/rooms', response.status === 200 && response.data.slug, null);
      if (response.data && response.data.slug) {
        testRoomSlug = response.data.slug;
        console.log(`  Created room: ${testRoomSlug}`);
      }
    } catch (error) {
      logTest('POST /api/rooms', false, error);
    }

    // Test 3: Get room by slug
    if (testRoomSlug) {
      try {
        const response = await axios.get(`${API_URL}/api/rooms/${testRoomSlug}`);
        logTest(`GET /api/rooms/${testRoomSlug}`, response.status === 200 && response.data.slug === testRoomSlug, null);
      } catch (error) {
        logTest(`GET /api/rooms/${testRoomSlug}`, false, error);
      }
    } else {
      console.log('⚠ Skipping GET /api/rooms/:slug - no room available');
      results.failed.push('GET /api/rooms/:slug (skipped)');
    }

    // Test 4: Get messages for a room
    if (testRoomSlug) {
      try {
        const response = await axios.get(`${API_URL}/api/rooms/${testRoomSlug}/messages`);
        logTest(`GET /api/rooms/${testRoomSlug}/messages`, response.status === 200 && Array.isArray(response.data), null);
        if (response.data && response.data.length > 0) {
          testMessageId = response.data[0].id;
          console.log(`  Found message: ${testMessageId}`);
        }
      } catch (error) {
        logTest(`GET /api/rooms/${testRoomSlug}/messages`, false, error);
      }
    } else {
      console.log('⚠ Skipping GET /api/rooms/:roomId/messages - no room available');
      results.failed.push('GET /api/rooms/:roomId/messages (skipped)');
    }

    // Test 5: Get user (try with userId 0)
    try {
      const response = await axios.get(`${API_URL}/api/users/0`);
      if (response.status === 200 && response.data) {
        testUserId = response.data.id;
        logTest('GET /api/users/0', true, null);
        console.log(`  Found user ID: ${testUserId}`);
      } else if (response.status === 404) {
        // User doesn't exist, we'll create one later
        logTest('GET /api/users/0', true, null);
        console.log('  User 0 does not exist (will be created on first message)');
        testUserId = 0;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        logTest('GET /api/users/0', true, null);
        console.log('  User 0 does not exist (will be created on first message)');
        testUserId = 0;
      } else {
        logTest('GET /api/users/0', false, error);
        // Try to create a user by updating nickname
        testUserId = 0;
      }
    }

    // Test 6: Update user nickname
    if (testUserId !== null) {
      try {
        const response = await axios.post(`${API_URL}/api/users/${testUserId}/nickname`, {
          nickname: 'Test User ' + Date.now()
        });
        logTest(`POST /api/users/${testUserId}/nickname`, response.status === 200 && response.data.success, null);
      } catch (error) {
        logTest(`POST /api/users/${testUserId}/nickname`, false, error);
      }
    } else {
      console.log('⚠ Skipping POST /api/users/:userId/nickname - no user available');
      results.failed.push('POST /api/users/:userId/nickname (skipped)');
    }

    // Test 7: Get message by ID (if we have a message)
    if (testMessageId) {
      try {
        const response = await axios.get(`${API_URL}/api/messages/${testMessageId}?before=5&after=5`);
        logTest(`GET /api/messages/${testMessageId}`, response.status === 200 && response.data.messages, null);
      } catch (error) {
        logTest(`GET /api/messages/${testMessageId}`, false, error);
      }
    } else {
      console.log('⚠ Skipping GET /api/messages/:messageId - no message available');
      results.failed.push('GET /api/messages/:messageId (skipped)');
    }

    // Test 8: Get likes for messages
    if (testMessageId) {
      try {
        const response = await axios.post(`${API_URL}/api/messages/likes`, {
          messageIds: [testMessageId]
        });
        logTest('POST /api/messages/likes', response.status === 200 && typeof response.data === 'object', null);
      } catch (error) {
        logTest('POST /api/messages/likes', false, error);
      }
    } else {
      console.log('⚠ Skipping POST /api/messages/likes - no message available');
      results.failed.push('POST /api/messages/likes (skipped)');
    }

    // Test 9: Get user liked messages
    if (testMessageId && testUserId !== null) {
      try {
        const response = await axios.post(`${API_URL}/api/messages/user-likes`, {
          messageIds: [testMessageId],
          userId: testUserId
        });
        logTest('POST /api/messages/user-likes', response.status === 200 && Array.isArray(response.data), null);
      } catch (error) {
        logTest('POST /api/messages/user-likes', false, error);
      }
    } else {
      console.log('⚠ Skipping POST /api/messages/user-likes - no message or user available');
      results.failed.push('POST /api/messages/user-likes (skipped)');
    }

    // Test 10: Like/unlike a message
    if (testMessageId && testUserId !== null) {
      try {
        const response = await axios.post(`${API_URL}/api/messages/${testMessageId}/like`, {
          userId: testUserId
        });
        logTest(`POST /api/messages/${testMessageId}/like`, response.status === 200 && typeof response.data.liked === 'boolean', null);
      } catch (error) {
        logTest(`POST /api/messages/${testMessageId}/like`, false, error);
      }
    } else {
      console.log('⚠ Skipping POST /api/messages/:messageId/like - no message or user available');
      results.failed.push('POST /api/messages/:messageId/like (skipped)');
    }

    // Test 11: Upload image (test with a simple request - will fail but tests endpoint)
    try {
      const formData = new FormData();
      // Create a simple test file buffer
      const testImageBuffer = Buffer.from('fake image data');
      formData.append('image', testImageBuffer, 'test.jpg');
      
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: formData.getHeaders()
      });
      
      // This might fail due to invalid image, but tests endpoint exists
      if (response.status === 200) {
        logTest('POST /api/upload', true, null);
      } else {
        logTest('POST /api/upload', false, new Error(`Unexpected status: ${response.status}`));
      }
    } catch (error) {
      // Check if it's a validation error (which means endpoint works)
      if (error.response && error.response.status === 400) {
        logTest('POST /api/upload (validation)', true, null);
        console.log('  Endpoint exists but rejected invalid image (expected)');
      } else {
        logTest('POST /api/upload', false, error);
      }
    }

  } catch (error) {
    console.error('Unexpected error during testing:', error);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Total: ${results.passed.length + results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed tests:');
    results.failed.forEach(name => console.log(`  - ${name}`));
  }
  
  if (results.errors.length > 0) {
    console.log('\nError details:');
    results.errors.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }

  console.log('\n' + '='.repeat(50));
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
testAllEndpoints().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

