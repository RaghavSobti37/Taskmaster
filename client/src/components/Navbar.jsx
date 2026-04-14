import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ProfileAvatar from './ProfileAvatar';
import ProfileDropdown from './ProfileDropdown';
import './Navbar.css';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">CoreKnot</Link>
      <div className="navbar-center">
        {isAuthenticated && (
          <>
            <div className="nav-links">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/team">Team</NavLink>
              <NavLink to="/projects">Projects</NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/server" className="server-link">👑 Server</NavLink>
              )}
              {user?.role === 'server_admin' && (
                <NavLink to="/server" className="server-link">👑 Admin</NavLink>
              )}
            </div>
          </>
        )}
      </div>
      <div className="navbar-right">
        {isAuthenticated && (
          <div className="profile-container">
            <button className="profile-avatar-button" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <ProfileAvatar 
                username={user?.username} 
                profilePicture={user?.profilePicture}
                profilePictureUrl={user?.profilePictureUrl}
              />
            </button>
            {isDropdownOpen && <ProfileDropdown user={user} onLogout={logout} />}
          </div>
        )}
        <button onClick={toggleTheme} className="theme-toggle">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;