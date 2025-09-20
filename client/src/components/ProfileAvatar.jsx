import React from 'react';
import './ProfileAvatar.css';

const ProfileAvatar = ({ username }) => {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  return (
    <div className="profile-avatar" title={username}>
      {initial}
    </div>
  );
};

export default ProfileAvatar;