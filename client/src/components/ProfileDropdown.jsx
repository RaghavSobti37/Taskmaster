import React from 'react';
import { Link } from 'react-router-dom';
import './ProfileDropdown.css';

const ProfileDropdown = ({ user, onLogout }) => {
  return (
    <div className="profile-dropdown">
      {user && (
        <div className="dropdown-header">
          <p className="dropdown-username">{user.username}</p>
          <p className="dropdown-role">{user.role?.toUpperCase()}</p>
        </div>
      )}
      <ul>
        <li>
          <Link to="/profile" className="dropdown-link">My Profile</Link>
        </li>
        <li>
          <button onClick={onLogout} className="dropdown-logout-button">Logout</button>
        </li>
      </ul>
    </div>
  );
};

export default ProfileDropdown;