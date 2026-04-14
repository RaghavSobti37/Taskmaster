import React from 'react';
import './ProfileAvatar.css';

const ProfileAvatar = ({ username, profilePicture, profilePictureUrl, size = 'medium' }) => {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  
  const getImageUrl = () => {
    // Prefer profilePictureUrl over profilePicture
    const imageSource = profilePictureUrl || profilePicture;
    
    if (!imageSource) return null;
    
    // If it's a relative path to uploaded image, use API base URL
    if (imageSource.startsWith('/')) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      return `${apiUrl}${imageSource}`;
    }
    
    // If it's base64 or full URL, use as-is
    return imageSource;
  };
  
  const imageUrl = getImageUrl();
  
  return (
    <div className={`profile-avatar avatar-${size}`} title={username}>
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={username}
          onError={(e) => {
            // Fallback to initial if image fails
            e.target.style.display = 'none';
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
};

export default ProfileAvatar;