import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './UserSearchModal.css';

const UserSearchModal = ({ isOpen, onClose, onSelectUsers, title = 'Add Users', selectedUserIds = [], allowMultiple = true }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set(selectedUserIds));
  const [isSearching, setIsSearching] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  // Fetch all users initially
  useEffect(() => {
    if (isOpen) {
      fetchAllUsers();
    }
  }, [isOpen]);

  const fetchAllUsers = async () => {
    try {
      const { data } = await api.get('/users/all');
      setAllUsers(data);
      setSearchResults(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  // Handle search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(allUsers);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, allUsers]);

  const handleUserToggle = (userId) => {
    if (!allowMultiple) {
      setSelectedUsers(new Set([userId]));
    } else {
      const newSelected = new Set(selectedUsers);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      setSelectedUsers(newSelected);
    }
  };

  const handleConfirm = () => {
    const selectedArray = Array.from(selectedUsers);
    onSelectUsers(selectedArray);
    setSearchQuery('');
    setSelectedUsers(new Set());
  };

  const handleCancel = () => {
    setSearchQuery('');
    setSelectedUsers(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="user-search-modal-overlay">
      <div className="user-search-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={handleCancel}>✕</button>
        </div>

        <div className="modal-search-container">
          <input
            type="text"
            className="modal-search-input"
            placeholder="Search users by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {isSearching && <span className="search-spinner">🔍</span>}
        </div>

        <div className="modal-users-list">
          {searchResults.length > 0 ? (
            searchResults.map(user => (
              <div
                key={user._id}
                className={`modal-user-item ${selectedUsers.has(user._id) ? 'selected' : ''}`}
                onClick={() => handleUserToggle(user._id)}
              >
                <input
                  type={allowMultiple ? 'checkbox' : 'radio'}
                  checked={selectedUsers.has(user._id)}
                  onChange={() => {}}
                  className="user-item-checkbox"
                />
                <div className="user-item-info">
                  <div className="user-item-name">
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                  </div>
                  <div className="user-item-username">@{user.username}</div>
                </div>
                {user.role && (
                  <span className={`user-item-role role-${user.role}`}>
                    {user.role}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="modal-empty-state">
              {searchQuery ? `No users found for "${searchQuery}"` : 'No users available'}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-modal-cancel" onClick={handleCancel}>Cancel</button>
          <button
            className="btn-modal-confirm"
            onClick={handleConfirm}
            disabled={selectedUsers.size === 0}
          >
            Confirm {selectedUsers.size > 0 && `(${selectedUsers.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;
