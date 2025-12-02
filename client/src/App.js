import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import io from 'socket.io-client';
import axios from 'axios';
import { getStoredUserId, setStoredUserId } from './utils';
import './App.css';

// Auto-detect API URL based on current hostname
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  // In production, use the same origin (Nginx proxies to backend)
  return window.location.origin;
};

const API_URL = getApiUrl();

// User ID to display name mapping
function getUserDisplayName(userId, userNicknames = {}) {
  if (userId === null || userId === undefined) return 'User ?';
  
  // Check if user has a nickname
  if (userNicknames[userId]) {
    return userNicknames[userId];
  }
  
  // Display userId directly (starts from 0)
  return `User ${userId}`;
}

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState(() => getStoredUserId()); // Initialize from cookie
  const [userNickname, setUserNickname] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsNameInput, setSettingsNameInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [sharedMessage, setSharedMessage] = useState(null);
  const [likedMessages, setLikedMessages] = useState(new Set());
  const [roomTitle, setRoomTitle] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [renameInput, setRenameInput] = useState('');
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const userNicknamesRef = useRef({}); // Nicknames for users
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageRefs = useRef({});
  const lastTapRef = useRef(0);
  const hasLoadedMessagesFromUrlRef = useRef(false);
  const isLoadingOlderRef = useRef(false);

  const { roomSlug } = useParams();
  const navigate = useNavigate();
  const roomId = roomSlug || 'default';

  // Track page view for room/message pages
  useEffect(() => {
    if (roomSlug) {
      const urlParams = new URLSearchParams(window.location.search);
      const messageId = urlParams.get('msg');
      const path = messageId ? `/${roomSlug}?msg=${messageId}` : `/${roomSlug}`;
      
      axios.post(`${API_URL}/api/track-page-view`, { path })
        .catch(err => console.error('Error tracking page view:', err));
    }
  }, [roomSlug]);

  useEffect(() => {
    if (!roomSlug) {
      navigate('/');
      return;
    }

    // Reset room data when room changes
    setRoomTitle(null);
    setRoomData(null);
    setHasMoreMessages(true);
    setIsLoadingOlder(false);
    isLoadingOlderRef.current = false;

    let newSocket = null;
    let isMounted = true;

    // First, verify the room exists before connecting
    const setupRoom = async () => {
      try {
        // Check if room exists
        const roomResponse = await axios.get(`${API_URL}/api/rooms/${roomSlug}`);
        if (!roomResponse.data) {
          if (isMounted) {
            navigate('/');
          }
          return;
        }
        // Store room data
        if (isMounted && roomResponse.data) {
          setRoomData(roomResponse.data);
          setRoomTitle(roomResponse.data.title || roomResponse.data.slug || 'Fastt Chat');
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          if (isMounted) {
            navigate('/');
          }
          return;
        }
        console.error('Error verifying room:', error);
        // Continue anyway - let socket handle it
      }

      // Room exists, proceed with socket connection
      if (!isMounted) return;

      // Check for message ID in URL - do this before socket setup
      const urlParams = new URLSearchParams(window.location.search);
      const messageIdParam = urlParams.get('msg');
      hasLoadedMessagesFromUrlRef.current = false;

      // If message ID is in URL, fetch messages around it
      if (messageIdParam) {
        setHighlightedMessageId(messageIdParam);
        axios.get(`${API_URL}/api/messages/${messageIdParam}`)
          .then(async response => {
            if (!isMounted) return;
            if (response.data.messages && response.data.messages.length > 0) {
              hasLoadedMessagesFromUrlRef.current = true;
              const messages = response.data.messages;
              
              // Store nicknames from messages
              messages.forEach(msg => {
                if (msg.username && msg.userId !== undefined) {
                  userNicknamesRef.current[msg.userId] = msg.username;
                }
              });
              
              // Get like counts for all messages
              const messageIds = messages.map(m => m.id);
              try {
                const likesResponse = await axios.post(`${API_URL}/api/messages/likes`, { messageIds });
                const messagesWithLikes = messages.map(msg => ({
                  ...msg,
                  likeCount: likesResponse.data[msg.id] || 0
                }));
                setMessages(messagesWithLikes);
                // When loading from URL, assume there might be more messages
                setHasMoreMessages(true);
              } catch (error) {
                // If likes endpoint doesn't exist, just use messages as is
                setMessages(messages);
                setHasMoreMessages(true);
              }
              // Scroll to message after messages are rendered
              // Use requestAnimationFrame to ensure DOM is updated
              requestAnimationFrame(() => {
                setTimeout(() => {
                  scrollToMessage(messageIdParam);
                }, 100);
              });
            }
          })
          .catch(error => {
            console.error('Error fetching message:', error);
          });
      }

      // Connect to socket for real-time updates
      newSocket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      newSocket.on('connect', () => {
        if (!isMounted) return;
        console.log('Connected to server');
        // Identify user first - use stored userId or current state
        const currentUserId = getStoredUserId() ?? userId;
        console.log('Identifying user:', currentUserId);
        // Only send userId if it's not null/undefined - let server create new user if needed
        if (currentUserId !== null && currentUserId !== undefined) {
          newSocket.emit('identify', { userId: currentUserId });
        } else {
          newSocket.emit('identify', {});
        }
      });
      
      newSocket.on('identified', async (data) => {
        if (!isMounted) return;
        console.log('User identified:', data.userId);
        // User ID assigned/confirmed
        const newUserId = data.userId;
        setUserId(newUserId);
        setStoredUserId(newUserId);
        if (data.nickname) {
          setUserNickname(data.nickname);
          userNicknamesRef.current[newUserId] = data.nickname;
        }
        
        // Now join the room
        console.log('Joining room:', roomId);
        newSocket.emit('join-room', { roomId });
      });

      newSocket.on('recent-messages', (recentMessages) => {
        if (!isMounted) return;
        console.log('Received recent messages:', recentMessages.length);
        // Only set if we don't already have messages from URL
        if (!hasLoadedMessagesFromUrlRef.current) {
          // Store nicknames from messages
          recentMessages.forEach(msg => {
            if (msg.username && msg.userId !== undefined) {
              userNicknamesRef.current[msg.userId] = msg.username;
            }
          });
          setMessages(recentMessages);
          // If we got 30 messages, there might be more
          setHasMoreMessages(recentMessages.length >= 30);
          
          // Scroll to bottom immediately after loading initial messages
          setTimeout(() => {
            if (messagesEndRef.current && !highlightedMessageId) {
              messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
          }, 100);
        }
      });

      newSocket.on('new-message', (message) => {
        if (!isMounted) return;
        console.log('Received new message:', message);
        // Store nickname from message
        if (message.username && message.userId !== undefined) {
          userNicknamesRef.current[message.userId] = message.username;
        }
        
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      });

      newSocket.on('like-update', (data) => {
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, likeCount: data.likeCount || 0 }
            : msg
        ));
      });

      newSocket.on('user-typing', (data) => {
        if (data.userId !== undefined) {
          const displayName = userNicknamesRef.current[data.userId] || `User ${data.userId}`;
          setTypingUsers(prev => new Set([...prev, displayName]));
        }
      });

      newSocket.on('user-stopped-typing', (data) => {
        if (data.userId !== undefined) {
          const displayName = userNicknamesRef.current[data.userId] || `User ${data.userId}`;
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(displayName);
            return newSet;
          });
        }
      });

      newSocket.on('room-not-found', (data) => {
        console.warn('Room not found:', data.roomId);
        if (isMounted) {
          navigate('/');
        }
      });

      newSocket.on('error', (data) => {
        console.error('Socket error:', data.message);
        if (isMounted) {
          alert(`Socket error: ${data.message}`);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        if (isMounted) {
          alert('Failed to connect to server. Please check if the server is running.');
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
      });

      setSocket(newSocket);
    };

    // Call setupRoom to verify room and set up socket
    setupRoom();

    return () => {
      isMounted = false;
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [roomSlug, navigate]);

  useEffect(() => {
    // Only auto-scroll if we're not highlighting a specific message
    // and we have messages, and we're not loading older messages
    if (!highlightedMessageId && messages.length > 0 && !isLoadingOlderRef.current) {
      scrollToBottom(false); // smooth scroll for new messages
    }
  }, [messages, highlightedMessageId]);

  // Track shared message for OpenGraph metadata
  useEffect(() => {
    if (highlightedMessageId && messages.length > 0) {
      const message = messages.find(m => m.id === highlightedMessageId);
      setSharedMessage(message || null);
    } else {
      setSharedMessage(null);
    }
  }, [highlightedMessageId, messages]);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  };

  const scrollToMessage = (messageId) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
        // Clean up URL
        const url = new URL(window.location);
        url.searchParams.delete('msg');
        window.history.replaceState({}, '', url);
      }, 3000);
    }
  };

  const loadOlderMessages = async () => {
    if (isLoadingOlderRef.current || !hasMoreMessages || messages.length === 0) {
      return;
    }

    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      // Get the oldest message timestamp
      const oldestMessage = messages[0];
      const beforeTimestamp = oldestMessage.timestamp;

      // Save current scroll position
      const container = messagesContainerRef.current;
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;

      const response = await axios.get(`${API_URL}/api/rooms/${roomId}/messages/older`, {
        params: {
          before: beforeTimestamp,
          limit: 30
        }
      });

      const olderMessages = response.data || [];

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // Store nicknames from older messages
        olderMessages.forEach(msg => {
          if (msg.username && msg.userId !== undefined) {
            userNicknamesRef.current[msg.userId] = msg.username;
          }
        });

        // Prepend older messages
        setMessages(prev => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = olderMessages.filter(m => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });

        // Restore scroll position after a brief delay to allow DOM update
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - scrollHeight;
            container.scrollTop = scrollTop + scrollDiff;
          }
        });
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Check if user scrolled near the top (within 100px)
    if (container.scrollTop < 100 && hasMoreMessages && !isLoadingOlderRef.current) {
      loadOlderMessages();
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() && !isUploading) return;
    if (!socket) {
      console.error('Cannot send message: socket not connected');
      alert('Not connected to server. Please wait a moment and try again.');
      return;
    }
    
    if (!socket.connected) {
      console.error('Cannot send message: socket not connected');
      alert('Not connected to server. Please wait a moment and try again.');
      return;
    }

    console.log('Sending message:', inputText.trim());
    socket.emit('message', {
      text: inputText.trim()
    });

    setInputText('');
    stopTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!socket) return;
    
    socket.emit('typing', { userId });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing');
      stopTyping();
    }, 3000);
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !socket) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      socket.emit('message', {
        imageUrl: response.data.imageUrl
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      animation: slideUp 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
  };

  const handleShareMessage = async (message) => {
    // Generate shareable link with message ID
    const shareUrl = `${window.location.origin}${window.location.pathname}?msg=${message.id}`;
    const shareText = message.text || 'Shared from Fastt Chat';
    
    const shareData = {
      title: 'Fastt Chat',
      text: `${message.userId || message.username}: ${shareText}`,
      url: shareUrl
    };

    try {
      // Try native Web Share API first (works on mobile)
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard (desktop)
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          showToast('✓ Link copied to clipboard!');
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = shareUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showToast('✓ Link copied to clipboard!');
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        // Fallback to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          showToast('✓ Link copied to clipboard!');
        }
      }
    }
  };

  const handleShareChat = async () => {
    const chatUrl = `${window.location.origin}${window.location.pathname}`;
    const shareText = `Join me in "${roomTitle || roomSlug}" on Fastt Chat!`;
    
    const shareData = {
      title: roomTitle || 'Fastt Chat',
      text: shareText,
      url: chatUrl
    };

    try {
      // Try native Web Share API first (works on mobile)
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard (desktop)
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(chatUrl);
          showToast('✓ Chat link copied to clipboard!');
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = chatUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showToast('✓ Chat link copied to clipboard!');
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing chat:', error);
        // Fallback to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(chatUrl);
          showToast('✓ Chat link copied to clipboard!');
        }
      }
    }
  };

  const handleLikeMessage = async (messageId, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    
    try {
      const response = await axios.post(`${API_URL}/api/messages/${messageId}/like`, {
        userId
      });
      
      // Update local state
      setLikedMessages(prev => {
        const newSet = new Set(prev);
        if (response.data.liked) {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error liking message:', error);
    }
  };

  const handleDoubleTap = (messageId, e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapRef.current;
    
    if (tapLength < 300 && tapLength > 0) {
      // Double tap detected
      handleLikeMessage(messageId, e);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = currentTime;
    }
  };

  const handleSaveSettings = async () => {
    const newNickname = settingsNameInput.trim();
    
    // Wait for user identification if not yet identified
    if (userId === null || userId === undefined) {
      // Wait a bit for identification
      await new Promise(resolve => setTimeout(resolve, 500));
      if (userId === null || userId === undefined) {
        alert('Please wait for user identification. Try again in a moment.');
        return;
      }
    }
    
    try {
      await axios.post(`${API_URL}/api/users/${userId}/nickname`, {
        nickname: newNickname || null
      });
      
      setUserNickname(newNickname || null);
      userNicknamesRef.current[userId] = newNickname || null;
      
      // Update nickname in all messages from this user
      setMessages(prev => prev.map(msg => 
        msg.userId === userId 
          ? { ...msg, username: newNickname || `User ${userId}` }
          : msg
      ));
      
      setShowSettings(false);
      setSettingsNameInput('');
    } catch (error) {
      console.error('Error saving nickname:', error);
      alert('Failed to save nickname. Please try again.');
    }
  };

  const handleOpenSettings = () => {
    // Wait a moment for identification if needed
    if (userId === null || userId === undefined) {
      // Try to wait for identification
      setTimeout(() => {
        if (userId !== null && userId !== undefined) {
          setSettingsNameInput(userNickname || '');
          // Initialize rename input if user is room creator
          if (isRoomCreator && roomTitle) {
            setRenameInput(roomTitle);
          }
          setShowSettings(true);
        } else {
          alert('Please wait for user identification. Try again in a moment.');
        }
      }, 500);
    } else {
      setSettingsNameInput(userNickname || '');
      // Initialize rename input if user is room creator
      if (isRoomCreator && roomTitle) {
        setRenameInput(roomTitle);
      }
      setShowSettings(true);
    }
  };

  const handleRenameRoom = async () => {
    if (!renameInput.trim() || !roomSlug || !userId) return;

    try {
      const response = await axios.put(`${API_URL}/api/rooms/${roomSlug}`, {
        title: renameInput.trim(),
        userId
      });

      setRoomTitle(response.data.title || response.data.slug);
      setRoomData(response.data);
      setRenameInput('');
    } catch (error) {
      console.error('Error renaming room:', error);
      alert(error.response?.data?.error || 'Failed to rename room. Please try again.');
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomSlug || !userId) return;

    if (!window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/rooms/${roomSlug}`, {
        params: { userId }
      });

      // Redirect to homepage after deletion
      navigate('/');
    } catch (error) {
      console.error('Error deleting room:', error);
      alert(error.response?.data?.error || 'Failed to delete room. Please try again.');
    }
  };

  const isRoomCreator = roomData && userId && roomData.creatorId && parseInt(roomData.creatorId) === parseInt(userId);
  
  // Load user nickname on mount
  useEffect(() => {
    if (userId !== null) {
      axios.get(`${API_URL}/api/users/${userId}`)
        .then(response => {
          if (response.data && response.data.nickname) {
            setUserNickname(response.data.nickname);
            userNicknamesRef.current[userId] = response.data.nickname;
          }
        })
        .catch(error => {
          console.log('Could not load user nickname:', error);
        });
    }
  }, [userId]);

  // Calculate OpenGraph metadata
  const ogTitle = roomTitle ? `${roomTitle} - Fastt Chat` : 'Fastt Chat';
  const ogDescription = 'Fastt Chat - High-performance real-time messaging';
  const ogImage = sharedMessage?.imageUrl 
    ? `${API_URL}${sharedMessage.imageUrl}`
    : null;
  const ogUrl = window.location.href;

  return (
    <div className="App">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        
        {/* OpenGraph tags */}
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ogUrl} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        {ogImage && <meta property="og:image:width" content="1200" />}
        {ogImage && <meta property="og:image:height" content="630" />}
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      <div className="chat-container">
        <header className="chat-header">
          <button 
            className="home-button"
            onClick={() => navigate('/')}
            aria-label="Home"
            title="Home"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <h1>{roomTitle || roomSlug || 'Fastt Chat'}</h1>
          <button 
            className="settings-button"
            onClick={handleOpenSettings}
            aria-label="Settings"
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
            </svg>
          </button>
        </header>

        {showSettings && (
          <div className="settings-overlay" onClick={() => setShowSettings(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-header">
                <h2>Settings</h2>
                <button 
                  className="settings-close"
                  onClick={() => setShowSettings(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="settings-content">
                <div className="settings-section">
                  <label htmlFor="custom-name">Username:</label>
                  <input
                    id="custom-name"
                    type="text"
                    className="settings-input"
                    placeholder="Enter your name (leave empty for default)"
                    value={settingsNameInput}
                    onChange={(e) => setSettingsNameInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveSettings();
                      }
                    }}
                    maxLength={50}
                    autoFocus
                  />
                </div>

                <div className="settings-section">
                  <h3>Share Chat</h3>
                  <p className="settings-hint">
                    Share this chat link with others to invite them to join
                  </p>
                  <div className="settings-share-section">
                    <input
                      type="text"
                      className="settings-input settings-share-input"
                      value={`${window.location.origin}${window.location.pathname}`}
                      readOnly
                      onClick={(e) => e.target.select()}
                    />
                    <button 
                      className="settings-share-button"
                      onClick={handleShareChat}
                      title="Share chat link"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                      </svg>
                      Share
                    </button>
                  </div>
                </div>

                {isRoomCreator && (
                  <div className="settings-section settings-room-section">
                    <h3>Chat Settings</h3>
                    <label htmlFor="rename-input">Chat Title:</label>
                    <input
                      id="rename-input"
                      type="text"
                      className="settings-input"
                      placeholder="Enter chat title"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameRoom();
                        }
                      }}
                      maxLength={100}
                    />
                    <div className="settings-room-actions">
                      <button 
                        className="settings-save-button"
                        onClick={handleRenameRoom}
                        disabled={!renameInput.trim()}
                      >
                        Rename Chat
                      </button>
                      <button 
                        className="settings-delete-button"
                        onClick={handleDeleteRoom}
                      >
                        Delete Chat
                      </button>
                    </div>
                  </div>
                )}

                <div className="settings-actions">
                  <button 
                    className="settings-save-button"
                    onClick={handleSaveSettings}
                  >
                    Save Name
                  </button>
                  <button 
                    className="settings-cancel-button"
                    onClick={() => setShowSettings(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div 
          className="messages-container"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {isLoadingOlder && (
            <div className="loading-older-messages">
              Loading older messages...
            </div>
          )}
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${highlightedMessageId === message.id ? 'message-highlighted' : ''}`}
              ref={el => messageRefs.current[message.id] = el}
              onTouchStart={(e) => handleDoubleTap(message.id, e)}
              onDoubleClick={(e) => handleLikeMessage(message.id, e)}
            >
              <div className="message-header">
                <div className="message-header-left">
                  <span className="message-userid">
                    {getUserDisplayName(message.userId, userNicknamesRef.current)}
                  </span>
                  <span className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-header-actions">
                  <button
                    className={`like-button-header ${likedMessages.has(message.id) ? 'liked' : ''}`}
                    onClick={(e) => handleLikeMessage(message.id, e)}
                    aria-label="Like message"
                    title="Like message"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={likedMessages.has(message.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    {message.likeCount > 0 && (
                      <span className="like-count-header">{message.likeCount}</span>
                    )}
                  </button>
                  <button 
                    className="share-button"
                    onClick={() => handleShareMessage(message)}
                    aria-label="Share message"
                    title="Share message"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </button>
                </div>
              </div>
              {message.imageUrl && (
                <div className="message-image">
                  <img 
                    src={`${API_URL}${message.imageUrl}`} 
                    alt="Shared" 
                    loading="lazy"
                  />
                </div>
              )}
              {message.text && (
                <div className="message-text">{message.text}</div>
              )}
            </div>
          ))}
          {typingUsers.size > 0 && (
            <div className="typing-indicator">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
            id="image-upload"
          />
          <label htmlFor="image-upload" className="upload-button" title="Upload image">
            +
          </label>
          <input
            type="text"
            className="message-input"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            disabled={isUploading}
          />
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={isUploading || (!inputText.trim() && !isUploading)}
          >
            {isUploading ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

