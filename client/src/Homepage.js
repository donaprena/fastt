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
      </div>
    </div>
  );
}

export default Homepage;

