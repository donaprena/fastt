import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { getStoredUserId } from './utils';
import './Homepage.css';

const API_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : window.location.origin);

function Homepage() {
  const [rooms, setRooms] = useState([]);
  const [newRoomTitle, setNewRoomTitle] = useState('New Chat Room');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const userId = getStoredUserId();
      const response = await axios.get(`${API_URL}/api/rooms`, {
        params: userId ? { userId } : {}
      });
      setRooms(response.data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const title = newRoomTitle.trim();
    
    if (!title) {
      alert('Please enter a room title');
      return;
    }
    
    setIsCreating(true);
    try {
      const userId = getStoredUserId();
      const response = await axios.post(`${API_URL}/api/rooms`, { 
        title,
        isPublic,
        userId
      });
      navigate(`/${response.data.slug}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert(error.response?.data?.error || 'Failed to create room. Please try again.');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (slug) => {
    navigate(`/${slug}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const ogTitle = 'Fastt Chat';
  const ogDescription = 'Fastt Chat - High-performance real-time messaging';
  const ogUrl = window.location.href;

  return (
    <div className="homepage">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        
        {/* OpenGraph tags */}
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ogUrl} />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
      </Helmet>
      <div className="homepage-container">
        <div className="homepage-header">
          <div className="homepage-logo-container">
            <svg className="homepage-logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
              <path d="M 70 30 L 30 50 L 42 54 L 46 70 L 55 55 L 70 30 Z" fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M 42 54 L 55 55" stroke="white" strokeWidth="2"/>
            </svg>
            <h1 className="homepage-logo">Fastt</h1>
          </div>
          <p className="homepage-tagline">fastt.chat</p>
        </div>
        
        <div className="homepage-content">
          <div className="homepage-intro">
            <h2>Fast Chats</h2>
            <p>
              Fastt lets you instantly create and share chat rooms for emergencies. 
              No sign-up required. Just enter a title and get a unique chat room link to share.
            </p>
          </div>

          <div className="homepage-actions">
            <form onSubmit={handleCreateRoom} className="create-room-form">
              <input
                type="text"
                className="room-input"
                placeholder="Enter room title"
                value={newRoomTitle}
                onChange={(e) => setNewRoomTitle(e.target.value)}
                maxLength={100}
                required
              />
              <button type="submit" className="create-button" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create New Chat'}
              </button>
            </form>
          </div>

          <div className="rooms-section">
            <h3>Recent Chats</h3>
            {isLoading ? (
              <p className="loading-text">Loading...</p>
            ) : rooms.length === 0 ? (
              <p className="empty-text">No chats yet. Create one above!</p>
            ) : (
              <div className="rooms-list">
                {rooms.map((room) => (
                  <div 
                    key={room.slug} 
                    className="room-card"
                    onClick={() => handleJoinRoom(room.slug)}
                  >
                    <div className="room-card-content">
                      <h4>{room.title || room.slug}</h4>
                      <p className="room-meta">
                        {room.lastMessageAt ? formatDate(room.lastMessageAt) : formatDate(room.createdAt)}
                      </p>
                    </div>
                    <div className="room-arrow">→</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <footer className="homepage-footer">
          <p className="footer-text">
            Open source and free forever
          </p>
          <a 
            href="https://github.com/yourusername/fastt-chat" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-github-link"
          >
            <svg className="github-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            View on GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}

export default Homepage;

