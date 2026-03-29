import React from 'react';
import './ProfileAvatar.css';

const ProfileAvatar = ({ username, profilePicture, size = 'medium' }) => {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  
  return (
    <div className={`profile-avatar avatar-${size}`} title={username}>
      {profilePicture ? (
        <img src={profilePicture} alt={username} />
      ) : (
        initial
      )}
    </div>
  );
};

export default ProfileAvatar;