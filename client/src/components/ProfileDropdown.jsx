import React from 'react';
import { Link } from 'react-router-dom';
import './ProfileDropdown.css';

const ProfileDropdown = ({ user, onLogout }) => {
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.username?.charAt(0).toUpperCase() || '?';
  };

  const getGreeting = () => {
    if (user?.firstName) {
      return `Hey ${user.firstName}!`;
    }
    return `Hey ${user?.username}!`;
  };

  return (
    <div className="profile-dropdown">
      {user && (
        <div className="dropdown-header">
          <div className="dropdown-avatar-section">
            <div className="dropdown-avatar">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt={user.username} />
              ) : (
                <span>{getInitials()}</span>
              )}
            </div>
            <div className="dropdown-text">
              <p className="dropdown-greeting">{getGreeting()}</p>
              <p className="dropdown-role">{user.role?.toUpperCase()}</p>
            </div>
          </div>
        </div>
      )}
      <ul>
        <li>
          <Link to="/profile" className="dropdown-link">My Profile</Link>
        </li>
        {(user?.role === 'admin' || user?.role === 'server_admin') && (
          <li>
            <Link to="/admin" className="dropdown-link">Server Administration</Link>
          </li>
        )}
        <li>
          <button onClick={onLogout} className="dropdown-logout-button">Logout</button>
        </li>
      </ul>
    </div>
  );
};

export default ProfileDropdown;