import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './ServerAdmin.css';

const ServerAdmin = () => {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchServerData = async () => {
    try {
      setIsLoading(true);
      const [logsRes, usersRes, statsRes] = await Promise.all([
        api.get('/admin/logs'),
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ]);
      setLogs(logsRes.data);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch server data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServerData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchServerData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      api.delete('/admin/logs').then(() => {
        setLogs([]);
      }).catch(err => console.error('Failed to clear logs:', err));
    }
  };

  const deleteUser = (userId, username) => {
    if (currentUser?.username === username) {
      alert('You cannot delete your own account');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      api.delete(`/admin/users/${userId}`)
        .then(() => {
          setUsers(users.filter(u => u._id !== userId));
          alert(`User ${username} has been deleted`);
        })
        .catch(err => {
          console.error('Failed to delete user:', err);
          alert(err.response?.data?.message || 'Failed to delete user');
        });
    }
  };

  const promoteToAdmin = (userId, username) => {
    if (window.confirm(`Promote "${username}" to admin?`)) {
      api.patch(`/admin/users/${userId}/promote`)
        .then(() => {
          setUsers(users.map(u => u._id === userId ? { ...u, role: 'admin' } : u));
          alert(`${username} has been promoted to admin`);
        })
        .catch(err => {
          console.error('Failed to promote user:', err);
          alert(err.response?.data?.message || 'Failed to promote user');
        });
    }
  };

  return (
    <div className="server-admin-container">
      <div className="server-header">
        <h1>Server Control Panel</h1>
        <div className="server-controls">
          <button className="refresh-btn" onClick={fetchServerData}>🔄 Refresh</button>
          <label className="auto-refresh-label">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-value">{stats.totalUsers || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Tasks</h3>
          <p className="stat-value">{stats.totalTasks || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Completed Tasks</h3>
          <p className="stat-value">{stats.completedTasks || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Active Users (24h)</h3>
          <p className="stat-value">{stats.activeUsersLast24h || 0}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Logs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
      </div>

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>Server Logs</h2>
            <button className="danger-btn" onClick={clearLogs}>🗑️ Clear Logs</button>
          </div>
          
          {isLoading ? (
            <p className="loading">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="empty-state">No logs available</p>
          ) : (
            <div className="logs-container">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Level</th>
                    <th>Message</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice().reverse().map((log, idx) => (
                    <tr key={idx} className={`log-level-${log.level?.toLowerCase() || 'info'}`}>
                      <td className="log-time">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`log-badge log-${log.level?.toLowerCase() || 'info'}`}>
                          {log.level || 'INFO'}
                        </span>
                      </td>
                      <td className="log-message">{log.message}</td>
                      <td className="log-source">{log.source || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>All Users</h2>
            <span className="user-count">Total: {users.length}</span>
          </div>
          
          {isLoading ? (
            <p className="loading">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="empty-state">No users found</p>
          ) : (
            <div className="users-grid">
              {users.map(user => (
                <div key={user._id} className="user-card">
                  <div className="user-card-header">
                    <div className="user-avatar">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className={`role-badge role-${user.role || 'user'}`}>
                      {(user.role || 'user').toUpperCase()}
                    </span>
                  </div>
                  <div className="user-info">
                    <h3>{user.username}</h3>
                    <p className="user-email">{user.email}</p>
                    <div className="user-stats">
                      <span>Tasks: {user.taskCount || 0}</span>
                      <span>Team: {user.circleCount || user.teamCount || 0}</span>
                    </div>
                    <p className="user-joined">
                      Joined: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="user-actions">
                    {user.role !== 'admin' && (
                      <button 
                        className="btn-promote"
                        onClick={() => promoteToAdmin(user._id, user.username)}
                      >
                        👑 Promote
                      </button>
                    )}
                    {currentUser?.username !== user.username && (
                      <button 
                        className="btn-delete"
                        onClick={() => deleteUser(user._id, user.username)}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerAdmin;
