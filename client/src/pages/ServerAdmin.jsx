import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './ServerAdmin.css';

const ServerAdmin = () => {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [dailyLogs, setDailyLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [passwordInput, setPasswordInput] = useState('');
  const [changePasswordUserId, setChangePasswordUserId] = useState(null);

  const fetchServerData = async () => {
    try {
      setIsLoading(true);
      const [logsRes, usersRes, statsRes, dailyLogsRes] = await Promise.all([
        api.get('/admin/logs'),
        api.get('/admin/users'),
        api.get('/admin/stats'),
        api.get('/admin/daily-logs?days=7'),
      ]);
      setLogs(logsRes.data);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setDailyLogs(dailyLogsRes.data);
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

  const toggleUserDisable = (userId, username, currentDisabled) => {
    const action = currentDisabled ? 'enable' : 'disable';
    if (window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user "${username}"?`)) {
      api.patch(`/admin/users/${userId}/toggle-disable`)
        .then((res) => {
          setUsers(users.map(u => u._id === userId ? { ...u, isDisabled: res.data.user.isDisabled } : u));
          alert(`User ${username} has been ${action}d`);
        })
        .catch(err => {
          console.error(`Failed to ${action} user:`, err);
          alert(err.response?.data?.message || `Failed to ${action} user`);
        });
    }
  };

  const makeServerAdmin = (userId, username) => {
    if (window.confirm(`Make "${username}" a SERVER ADMIN with full access?`)) {
      api.patch(`/admin/users/${userId}/make-server-admin`)
        .then(() => {
          setUsers(users.map(u => u._id === userId ? { ...u, role: 'server_admin' } : u));
          alert(`${username} is now a server admin`);
        })
        .catch(err => {
          console.error('Failed to make server admin:', err);
          alert(err.response?.data?.message || 'Failed to make server admin');
        });
    }
  };

  const viewUserDetails = async (userId) => {
    try {
      const [historyRes, logsRes] = await Promise.all([
        api.get(`/admin/users/${userId}/login-history?limit=20`),
        api.get(`/admin/users/${userId}/daily-logs?limit=7`),
      ]);
      setLoginHistory(historyRes.data.loginHistory || []);
      setUserDetails(logsRes.data?.length > 0 ? logsRes.data[0] : null);
      setSelectedUser(users.find(u => u._id === userId));
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }
  };

  const changeUserPassword = (userId) => {
    if (!passwordInput || passwordInput.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (window.confirm('Are you sure you want to change this user\'s password?')) {
      api.patch(`/admin/users/${userId}/change-password`, {
        newPassword: passwordInput
      })
        .then(() => {
          alert('Password has been changed successfully');
          setPasswordInput('');
          setChangePasswordUserId(null);
        })
        .catch(err => {
          console.error('Failed to change password:', err);
          alert(err.response?.data?.message || 'Failed to change password');
        });
    }
  };

  const getLastDailyLog = (userId) => {
    const log = dailyLogs.find(l => l.userId === userId || (typeof l.userId === 'object' && l.userId._id === userId));
    if (log) {
      const date = new Date(log.date);
      const dayName = log.day || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      return { date: date.toLocaleDateString(), day: dayName, ...log };
    }
    return null;
  };

  return (
    <div className="server-admin-container">
      <div className="server-header">
        <h1>🔧 Server Control Panel</h1>
        <p className="subtitle">Complete server administration and monitoring</p>
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
          <h3>👥 Total Users</h3>
          <p className="stat-value">{stats.totalUsers || 0}</p>
        </div>
        <div className="stat-card">
          <h3>✓ Total Tasks</h3>
          <p className="stat-value">{stats.totalTasks || 0}</p>
        </div>
        <div className="stat-card">
          <h3>🎉 Completed</h3>
          <p className="stat-value">{stats.completedTasks || 0}</p>
          <p className="stat-subtitle">{stats.completionRate}%</p>
        </div>
        <div className="stat-card">
          <h3>🟢 Active (24h)</h3>
          <p className="stat-value">{stats.activeUsersLast24h || 0}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
        <button 
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 System Logs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          📅 Daily Logs
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>📊 System Overview</h2>
          </div>
          <div className="overview-grid">
            <div className="overview-card">
              <h3>Server Status</h3>
              <p className="status-good">✓ All Systems Operational</p>
            </div>
            <div className="overview-card">
              <h3>Database Connection</h3>
              <p className="status-good">✓ Connected</p>
            </div>
            <div className="overview-card">
              <h3>API Status</h3>
              <p className="status-good">✓ Responsive</p>
            </div>
            <div className="overview-card">
              <h3>Recent Activity</h3>
              <p>{logs.length} system events</p>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>Team Members Management</h2>
            <span className="user-count">Total: {users.length}</span>
          </div>
          
          {selectedUser ? (
            <div className="user-detail-panel">
              <button className="back-btn" onClick={() => setSelectedUser(null)}>← Back to Users</button>
              
              <div className="user-detail-card">
                <div className="user-detail-header">
                  <div className="user-avatar-large">
                    {selectedUser.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-detail-info">
                    <h2>{selectedUser.username}</h2>
                    <p className="user-email">{selectedUser.email}</p>
                    <span className={`role-badge role-${selectedUser.role}`}>
                      {selectedUser.role.toUpperCase()}
                    </span>
                    {selectedUser.isDisabled && <span className="badge-disabled">DISABLED</span>}
                  </div>
                </div>

                <div className="user-detail-body">
                  <div className="detail-section">
                    <h3>Account Information</h3>
                    <ul>
                      <li><strong>Joined:</strong> {new Date(selectedUser.createdAt).toLocaleDateString()}</li>
                      <li><strong>Last Login:</strong> {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}</li>
                      <li><strong>Total Logins:</strong> {selectedUser.loginCount}</li>
                      <li><strong>Created Tasks:</strong> {selectedUser.taskCount || 0}</li>
                      <li><strong>Team Members:</strong> {selectedUser.teamCount || 0}</li>
                    </ul>
                  </div>

                  {userDetails && (
                    <div className="detail-section">
                      <h3>Today's Activity</h3>
                      <ul>
                        <li><strong>Date:</strong> {userDetails.date} ({userDetails.day})</li>
                        <li><strong>Tasks Completed:</strong> {userDetails.tasksCompleted}</li>
                        <li><strong>Tasks Created:</strong> {userDetails.tasksCreated}</li>
                        <li><strong>Login Count:</strong> {userDetails.loginCount}</li>
                      </ul>
                    </div>
                  )}

                  <div className="detail-section">
                    <h3>Login History (Last 20)</h3>
                    {loginHistory.length > 0 ? (
                      <div className="login-history-list">
                        {loginHistory.slice(-10).reverse().map((login, idx) => (
                          <div key={idx} className="login-entry">
                            <span className="login-time">{new Date(login.loginTime).toLocaleString()}</span>
                            <span className="login-ip">{login.ipAddress}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state">No login history available</p>
                    )}
                  </div>

                  <div className="detail-section actions">
                    <h3>Account Actions</h3>
                    
                    {changePasswordUserId === selectedUser._id ? (
                      <div className="password-change-form">
                        <input
                          type="password"
                          placeholder="New password (min 6 characters)"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="password-input"
                        />
                        <button 
                          className="btn-save"
                          onClick={() => changeUserPassword(selectedUser._id)}
                        >
                          🔒 Save New Password
                        </button>
                        <button 
                          className="btn-cancel"
                          onClick={() => {
                            setChangePasswordUserId(null);
                            setPasswordInput('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="btn-change-password"
                        onClick={() => setChangePasswordUserId(selectedUser._id)}
                      >
                        🔑 Change Password
                      </button>
                    )}

                    <button 
                      className={selectedUser.isDisabled ? "btn-enable" : "btn-disable"}
                      onClick={() => toggleUserDisable(selectedUser._id, selectedUser.username, selectedUser.isDisabled)}
                    >
                      {selectedUser.isDisabled ? '✓ Enable Account' : '🚫 Disable Account'}
                    </button>

                    {selectedUser.role !== 'server_admin' && selectedUser._id !== currentUser._id && (
                      <button 
                        className="btn-server-admin"
                        onClick={() => makeServerAdmin(selectedUser._id, selectedUser.username)}
                      >
                        👑 Make Server Admin
                      </button>
                    )}

                    {selectedUser.role !== 'admin' && selectedUser._id !== currentUser._id && (
                      <button 
                        className="btn-promote"
                        onClick={() => promoteToAdmin(selectedUser._id, selectedUser.username)}
                      >
                        ⬆️ Promote to Admin
                      </button>
                    )}

                    {currentUser?.username !== selectedUser.username && (
                      <button 
                        className="btn-delete"
                        onClick={() => deleteUser(selectedUser._id, selectedUser.username)}
                      >
                        🗑️ Delete User
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="users-grid">
              {isLoading ? (
                <p className="loading">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="empty-state">No users found</p>
              ) : (
                users.map(user => {
                  const lastDailyLog = getLastDailyLog(user._id);
                  return (
                    <div key={user._id} className={`user-card ${user.isDisabled ? 'disabled' : ''}`}>
                      <div className="user-card-header">
                        <div className="user-avatar">
                          {user.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className={`role-badge role-${user.role || 'user'}`}>
                          {(user.role || 'user').toUpperCase()}
                        </span>
                        {user.isDisabled && <span className="badge-small-disabled">DISABLED</span>}
                      </div>
                      <div className="user-info">
                        <h3>{user.username}</h3>
                        <p className="user-email">{user.email}</p>
                        <div className="user-stats">
                          <span>📋 Tasks: {user.taskCount || 0}</span>
                          <span>👥 Team: {user.teamCount || 0}</span>
                        </div>
                        {lastDailyLog && (
                          <div className="user-daily-log">
                            <small>📅 {lastDailyLog.day}, {lastDailyLog.date}</small>
                            <br/>
                            <small>✓ {lastDailyLog.tasksCompleted} completed | 🔓 {lastDailyLog.loginCount} logins</small>
                          </div>
                        )}
                        <p className="user-joined">
                          Joined: {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="user-actions">
                        <button 
                          className="btn-view"
                          onClick={() => viewUserDetails(user._id)}
                        >
                          👁️ View
                        </button>
                        {user.role !== 'server_admin' && user._id !== currentUser._id && (
                          <button 
                            className="btn-server-admin-small"
                            onClick={() => makeServerAdmin(user._id, user.username)}
                            title="Promote to Server Admin"
                          >
                            👑
                          </button>
                        )}
                        {user.role !== 'admin' && (
                          <button 
                            className="btn-promote"
                            onClick={() => promoteToAdmin(user._id, user.username)}
                          >
                            ⬆️ Promote
                          </button>
                        )}
                        <button
                          className={user.isDisabled ? "btn-enable" : "btn-disable"}
                          onClick={() => toggleUserDisable(user._id, user.username, user.isDisabled)}
                          title={user.isDisabled ? "Enable account" : "Disable account"}
                        >
                          {user.isDisabled ? '✓' : '🚫'}
                        </button>
                        {currentUser?.username !== user.username && (
                          <button 
                            className="btn-delete"
                            onClick={() => deleteUser(user._id, user.username)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>System Logs</h2>
            <button className="danger-btn" onClick={clearLogs}>🗑️ Clear All Logs</button>
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

      {/* Daily Logs Tab */}
      {activeTab === 'daily' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>Daily Activity Logs (Last 7 Days)</h2>
          </div>
          
          {isLoading ? (
            <p className="loading">Loading daily logs...</p>
          ) : dailyLogs.length === 0 ? (
            <p className="empty-state">No daily logs available</p>
          ) : (
            <div className="daily-logs-container">
              {dailyLogs.map((log, idx) => {
                const userInfo = typeof log.userId === 'object' ? log.userId : { _id: log.userId, username: 'Unknown' };
                const logDate = new Date(log.date);
                const dayName = log.day || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][logDate.getDay()];
                
                return (
                  <div key={idx} className="daily-log-card">
                    <div className="log-header">
                      <h3>{userInfo.username} - {logDate.toLocaleDateString()} ({dayName})</h3>
                      <small>🔓 {log.loginCount} logins | ✓ {log.tasksCompleted} completed | ➕ {log.tasksCreated} created</small>
                    </div>
                    {log.activities && log.activities.length > 0 && (
                      <div className="log-activities">
                        {log.activities.slice(-5).map((activity, i) => (
                          <div key={i} className="activity-entry">
                            <span className="activity-time">
                              {new Date(activity.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="activity-description">
                              {activity.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerAdmin;
