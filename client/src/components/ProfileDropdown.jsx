import React from 'react';
import './ProfileDropdown.css';

const ProfileDropdown = ({ onLogout }) => {
  return (
    <div className="profile-dropdown">
      <ul>
        {/* Add other links like "Profile" or "Settings" here in the future */}
        <li>
          <button onClick={onLogout} className="dropdown-logout-button">Logout</button>
        </li>
      </ul>
    </div>
  );
};

export default ProfileDropdown;