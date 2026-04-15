import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './ServerAdmin.css';

const getDateString = (date) => date.toISOString().split('T')[0];

const getDaysAgoDateString = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getDateString(date);
};

const getLogUserId = (log) => {
  if (!log?.userId) {
    return '';
  }

  return typeof log.userId === 'object' ? log.userId._id : log.userId;
};

const dedupeDailyLogs = (inputLogs = []) => {
  const uniqueLogsMap = new Map();

  inputLogs.forEach((log) => {
    const userId = getLogUserId(log);
    const key = `${userId}-${log.date}`;
    const current = uniqueLogsMap.get(key);

    if (!current) {
      uniqueLogsMap.set(key, log);
      return;
    }

    const currentUpdatedAt = new Date(current.updatedAt || current.createdAt || 0).getTime();
    const nextUpdatedAt = new Date(log.updatedAt || log.createdAt || 0).getTime();

    if (nextUpdatedAt >= currentUpdatedAt) {
      uniqueLogsMap.set(key, log);
    }
  });

  return Array.from(uniqueLogsMap.values());
};

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

  const [selectedDailyDate, setSelectedDailyDate] = useState(getDateString(new Date()));
  const [loadedDailyDate, setLoadedDailyDate] = useState(getDateString(new Date()));
  const [selectedDailyUser, setSelectedDailyUser] = useState(null);
  const [userHistoryLogs, setUserHistoryLogs] = useState([]);
  const [isUserHistoryLoading, setIsUserHistoryLoading] = useState(false);
  const [userLogFilters, setUserLogFilters] = useState({
    fromDate: getDaysAgoDateString(30),
    toDate: getDateString(new Date()),
    search: ''
  });

  const [selectedReportUserId, setSelectedReportUserId] = useState('');
  const [reportRange, setReportRange] = useState('7');
  const [reportData, setReportData] = useState(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const fetchServerData = async (dailyDate = loadedDailyDate, options = {}) => {
    const { silent = false } = options;

    try {
      if (!silent) {
        setIsLoading(true);
      }
      const [logsRes, usersRes, statsRes, dailyLogsRes] = await Promise.all([
        api.get('/admin/logs'),
        api.get('/admin/users'),
        api.get('/admin/stats'),
        api.get(`/admin/daily-logs?date=${dailyDate}`)
      ]);

      const fetchedUsers = usersRes.data || [];

      setLogs(logsRes.data || []);
      setUsers(fetchedUsers);
      setStats(statsRes.data || {});
      setDailyLogs(dedupeDailyLogs(dailyLogsRes.data?.logs || []));
      setLoadedDailyDate(dailyDate);

      if (!selectedReportUserId && fetchedUsers.length > 0) {
        setSelectedReportUserId(fetchedUsers[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch server data:', error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchServerData();

    if (autoRefresh) {
      const interval = setInterval(() => fetchServerData(loadedDailyDate, { silent: true }), 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadedDailyDate]);

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      api.delete('/admin/logs').then(() => {
        setLogs([]);
      }).catch((err) => console.error('Failed to clear logs:', err));
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
          setUsers(users.filter((user) => user._id !== userId));
          alert(`User ${username} has been deleted`);
        })
        .catch((err) => {
          console.error('Failed to delete user:', err);
          alert(err.response?.data?.message || 'Failed to delete user');
        });
    }
  };

  const promoteToAdmin = (userId, username) => {
    if (window.confirm(`Promote "${username}" to admin?`)) {
      api.patch(`/admin/users/${userId}/promote`)
        .then(() => {
          setUsers(users.map((user) => (user._id === userId ? { ...user, role: 'admin' } : user)));
          alert(`${username} has been promoted to admin`);
        })
        .catch((err) => {
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
          setUsers(users.map((user) => (
            user._id === userId ? { ...user, isDisabled: res.data.user.isDisabled } : user
          )));
          alert(`User ${username} has been ${action}d`);
        })
        .catch((err) => {
          console.error(`Failed to ${action} user:`, err);
          alert(err.response?.data?.message || `Failed to ${action} user`);
        });
    }
  };

  const makeServerAdmin = (userId, username) => {
    if (window.confirm(`Make "${username}" a SERVER ADMIN with full access?`)) {
      api.patch(`/admin/users/${userId}/make-server-admin`)
        .then(() => {
          setUsers(users.map((user) => (user._id === userId ? { ...user, role: 'server_admin' } : user)));
          alert(`${username} is now a server admin`);
        })
        .catch((err) => {
          console.error('Failed to make server admin:', err);
          alert(err.response?.data?.message || 'Failed to make server admin');
        });
    }
  };

  const viewUserDetails = async (userId) => {
    try {
      const [historyRes, logsRes] = await Promise.all([
        api.get(`/admin/users/${userId}/login-history?limit=20`),
        api.get(`/admin/users/${userId}/daily-logs?limit=7`)
      ]);

      setLoginHistory(historyRes.data.loginHistory || []);
      setUserDetails(logsRes.data?.length > 0 ? logsRes.data[0] : null);
      setSelectedUser(users.find((user) => user._id === userId) || null);
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
        .catch((err) => {
          console.error('Failed to change password:', err);
          alert(err.response?.data?.message || 'Failed to change password');
        });
    }
  };

  const fetchUserHistoryLogs = async (userId, filters = userLogFilters) => {
    if (!userId) {
      return;
    }

    try {
      setIsUserHistoryLoading(true);
      const params = new URLSearchParams({ limit: '120' });

      if (filters.fromDate) {
        params.set('fromDate', filters.fromDate);
      }
      if (filters.toDate) {
        params.set('toDate', filters.toDate);
      }
      if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
      }

      const response = await api.get(`/admin/users/${userId}/daily-logs?${params.toString()}`);
      setUserHistoryLogs(response.data || []);

      const userFromList = users.find((user) => user._id === userId);
      if (userFromList) {
        setSelectedDailyUser(userFromList);
      }
    } catch (error) {
      console.error('Failed to fetch user history logs:', error);
      setUserHistoryLogs([]);
    } finally {
      setIsUserHistoryLoading(false);
    }
  };

  const fetchProgressReport = async (userId = selectedReportUserId, range = reportRange) => {
    if (!userId) {
      alert('Please select a user first');
      return;
    }

    try {
      setIsReportLoading(true);
      const response = await api.get(`/admin/users/${userId}/progress-report?range=${range}`);
      setReportData(response.data);
    } catch (error) {
      console.error('Failed to generate progress report:', error);
      alert(error.response?.data?.message || 'Failed to generate report');
      setReportData(null);
    } finally {
      setIsReportLoading(false);
    }
  };

  const getLastDailyLog = (userId) => {
    const log = dailyLogs.find(
      (entry) => entry.userId === userId || (typeof entry.userId === 'object' && entry.userId._id === userId)
    );

    if (!log) {
      return null;
    }

    const date = new Date(log.date);
    const completedCount = (log.tasks || []).filter((task) => task.status === 'completed').length;

    return {
      ...log,
      date: date.toLocaleDateString(),
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
      completedCount
    };
  };

  const selectedReportUser = useMemo(
    () => users.find((user) => user._id === selectedReportUserId) || null,
    [users, selectedReportUserId]
  );

  const summarySentences = useMemo(() => {
    if (!reportData?.summary) {
      return [];
    }

    return reportData.summary
      .split(/\.\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) => sentence.endsWith('.') ? sentence : `${sentence}.`);
  }, [reportData]);

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
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📈 Reports
        </button>
      </div>

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
                      <h3>Latest Daily Log</h3>
                      <ul>
                        <li><strong>Date:</strong> {userDetails.date}</li>
                        <li><strong>Total Tasks:</strong> {(userDetails.tasks || []).length}</li>
                        <li><strong>Total Hours:</strong> {userDetails.totalHours || 0}h</li>
                        <li><strong>Completed Tasks:</strong> {(userDetails.tasks || []).filter((task) => task.status === 'completed').length}</li>
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
                      className={selectedUser.isDisabled ? 'btn-enable' : 'btn-disable'}
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
                users.map((user) => {
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
                            <br />
                            <small>✓ {lastDailyLog.completedCount} completed | ⏱️ {lastDailyLog.totalHours || 0}h</small>
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
                          className={user.isDisabled ? 'btn-enable' : 'btn-disable'}
                          onClick={() => toggleUserDisable(user._id, user.username, user.isDisabled)}
                          title={user.isDisabled ? 'Enable account' : 'Disable account'}
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
                      <td className="log-time">{new Date(log.timestamp).toLocaleString()}</td>
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

      {activeTab === 'daily' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>Daily Activity Logs (All Users by Date)</h2>
          </div>

          <div className="daily-date-filter-row">
            <div className="daily-date-input-group">
              <label htmlFor="dailyDatePicker">Select Date</label>
              <input
                id="dailyDatePicker"
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
              />
            </div>
            <button className="refresh-btn daily-load-btn" onClick={() => fetchServerData(selectedDailyDate)}>Load Date</button>
          </div>

          <p className="daily-loaded-date-text">Showing logs for {loadedDailyDate}</p>

          {isLoading ? (
            <p className="loading">Loading daily logs...</p>
          ) : dailyLogs.length === 0 ? (
            <p className="empty-state">No daily logs available for this date</p>
          ) : (
            <div className="daily-logs-container">
              {dailyLogs.map((log, idx) => {
                const userInfo = typeof log.userId === 'object' ? log.userId : { _id: log.userId, username: 'Unknown' };
                const completed = (log.tasks || []).filter((task) => task.status === 'completed').length;
                const logKey = `${userInfo._id || 'unknown'}-${log.date}-${log._id || idx}`;

                return (
                  <div
                    key={logKey}
                    className="daily-log-card clickable"
                    onClick={() => fetchUserHistoryLogs(userInfo._id)}
                  >
                    <div className="log-header">
                      <h3>{userInfo.username} - {log.date}</h3>
                      <small>✓ {completed} completed | 📋 {(log.tasks || []).length} tasks | ⏱️ {log.totalHours || 0}h</small>
                    </div>

                    {(log.tasks || []).length > 0 && (
                      <div className="log-activities">
                        {(log.tasks || []).slice(0, 4).map((task, i) => (
                          <div key={i} className="activity-entry">
                            <span className="activity-time">{task.status.replace('_', ' ')}</span>
                            <span className="activity-description">{task.taskTitle}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {log.notes && <p className="daily-log-notes">📝 {log.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {selectedDailyUser && (
            <div className="user-history-panel">
              <div className="content-header">
                <h2>{selectedDailyUser.username} - Historical Daily Logs</h2>
              </div>

              <div className="history-filters">
                <div className="history-filter-item">
                  <label htmlFor="fromDate">From</label>
                  <input
                    id="fromDate"
                    type="date"
                    value={userLogFilters.fromDate}
                    onChange={(e) => setUserLogFilters({ ...userLogFilters, fromDate: e.target.value })}
                  />
                </div>
                <div className="history-filter-item">
                  <label htmlFor="toDate">To</label>
                  <input
                    id="toDate"
                    type="date"
                    value={userLogFilters.toDate}
                    onChange={(e) => setUserLogFilters({ ...userLogFilters, toDate: e.target.value })}
                  />
                </div>
                <div className="history-filter-item search">
                  <label htmlFor="searchLogs">Search Tasks/Notes</label>
                  <input
                    id="searchLogs"
                    type="text"
                    placeholder="Type keywords like API, bugfix, testing"
                    value={userLogFilters.search}
                    onChange={(e) => setUserLogFilters({ ...userLogFilters, search: e.target.value })}
                  />
                </div>
                <button
                  className="refresh-btn"
                  onClick={() => fetchUserHistoryLogs(selectedDailyUser._id)}
                >
                  Search Logs
                </button>
              </div>

              {isUserHistoryLoading ? (
                <p className="loading">Loading history logs...</p>
              ) : userHistoryLogs.length === 0 ? (
                <p className="empty-state">No historical logs found for selected filters</p>
              ) : (
                <div className="history-log-list">
                  {userHistoryLogs.map((log, idx) => (
                    <div key={idx} className="history-log-item">
                      <div className="history-log-head">
                        <h4>{log.date}</h4>
                        <small>📋 {(log.tasks || []).length} tasks | ⏱️ {log.totalHours || 0}h</small>
                      </div>
                      {(log.tasks || []).length > 0 && (
                        <ul className="history-task-list">
                          {(log.tasks || []).map((task, taskIdx) => (
                            <li key={taskIdx}>
                              <strong>{task.taskTitle}</strong> ({task.status.replace('_', ' ')}, {task.hoursSpent}h)
                              {task.description ? ` - ${task.description}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                      {log.notes && <p className="history-notes">📝 {log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="tab-content">
          <div className="content-header">
            <h2>Progress Reports & Analysis</h2>
          </div>

          <div className="report-controls">
            <div className="report-control-item">
              <label htmlFor="reportUser">User</label>
              <select
                id="reportUser"
                value={selectedReportUserId}
                onChange={(e) => setSelectedReportUserId(e.target.value)}
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>{user.username}</option>
                ))}
              </select>
            </div>

            <div className="report-control-item">
              <label htmlFor="reportRange">Range</label>
              <select
                id="reportRange"
                value={reportRange}
                onChange={(e) => setReportRange(e.target.value)}
              >
                <option value="1">Last Day</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="150">Last 150 Days</option>
                <option value="365">Last 1 Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <button
              className="refresh-btn"
              onClick={() => fetchProgressReport()}
            >
              Generate Report
            </button>
          </div>

          {isReportLoading && <p className="loading">Generating report...</p>}

          {!isReportLoading && reportData && (
            <div className="report-panel">
              <div className="report-header">
                <h3>{reportData.user.username} - {reportData.period.label}</h3>
                <p>{selectedReportUser?.email}</p>
              </div>

              <div className="report-metrics-grid">
                <div className="report-metric-card">
                  <span>Logged Days</span>
                  <strong>{reportData.metrics.totalLoggedDays}</strong>
                </div>
                <div className="report-metric-card">
                  <span>Total Hours</span>
                  <strong>{reportData.metrics.totalHours.toFixed(1)}h</strong>
                </div>
                <div className="report-metric-card">
                  <span>Total Tasks</span>
                  <strong>{reportData.metrics.totalTasks}</strong>
                </div>
                <div className="report-metric-card">
                  <span>Completion Rate</span>
                  <strong>{reportData.metrics.completionRate.toFixed(1)}%</strong>
                </div>
                <div className="report-metric-card">
                  <span>Avg Hours/Day</span>
                  <strong>{reportData.metrics.averageHoursPerLoggedDay.toFixed(2)}</strong>
                </div>
                <div className="report-metric-card">
                  <span>Avg Tasks/Day</span>
                  <strong>{reportData.metrics.averageTasksPerLoggedDay.toFixed(2)}</strong>
                </div>
              </div>

              <div className="report-section">
                <h4>Status Breakdown</h4>
                <div className="status-breakdown-grid">
                  <div>✅ Completed: {reportData.metrics.completedTasks}</div>
                  <div>⚙️ In Progress: {reportData.metrics.inProgressTasks}</div>
                  <div>🚫 Blocked: {reportData.metrics.blockedTasks}</div>
                  <div>⏳ Pending: {reportData.metrics.pendingTasks}</div>
                </div>
              </div>

              <div className="report-section">
                <h4>Focus Areas from Daily Logs</h4>
                {reportData.topFocusAreas.length > 0 ? (
                  <div className="focus-tags">
                    {reportData.topFocusAreas.map((item) => (
                      <span key={item.keyword} className="focus-tag">
                        {item.keyword} ({item.count})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No significant focus keywords found for this period.</p>
                )}
              </div>

              <div className="report-section">
                <h4>In-depth Summary</h4>
                <div className="report-summary-card">
                  <div className="report-summary-highlights">
                    <div className="report-summary-highlight">
                      <span>Top Output</span>
                      <strong>{reportData.metrics.totalTasks} tasks across {reportData.metrics.totalLoggedDays} day(s)</strong>
                    </div>
                    <div className="report-summary-highlight">
                      <span>Workload</span>
                      <strong>{reportData.metrics.totalHours.toFixed(1)}h total, {reportData.metrics.averageHoursPerLoggedDay.toFixed(2)}h avg/day</strong>
                    </div>
                    <div className="report-summary-highlight">
                      <span>Delivery</span>
                      <strong>{reportData.metrics.completedTasks} completed with {reportData.metrics.completionRate.toFixed(1)}% completion</strong>
                    </div>
                  </div>

                  {summarySentences.length > 0 && (
                    <div className="report-summary-points">
                      {summarySentences.map((sentence, idx) => (
                        <div key={idx} className="report-summary-point">
                          {sentence}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="report-section">
                <h4>Recent Work Breakdown</h4>
                {reportData.recentLogs.length > 0 ? (
                  <div className="report-recent-logs">
                    {reportData.recentLogs.slice(0, 5).map((log, idx) => (
                      <div key={idx} className="report-recent-log-item">
                        <h5>{log.date} • {(log.tasks || []).length} tasks • {log.totalHours || 0}h</h5>
                        {(log.tasks || []).length > 0 ? (
                          <ul>
                            {(log.tasks || []).slice(0, 5).map((task, taskIdx) => (
                              <li key={taskIdx}>
                                <strong>{task.taskTitle}</strong> ({task.status.replace('_', ' ')}, {task.hoursSpent}h)
                                {task.description ? ` - ${task.description}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty-state">No task entries for this day.</p>
                        )}
                        {log.notes && <p className="history-notes">📝 {log.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No recent logs available for this report range.</p>
                )}
              </div>

              {reportData.metrics.mostActiveDay && (
                <div className="report-section">
                  <h4>Most Active Day</h4>
                  <p>
                    {reportData.metrics.mostActiveDay.date}: {reportData.metrics.mostActiveDay.totalHours.toFixed(1)}h,
                    {' '}
                    {reportData.metrics.mostActiveDay.totalTasks} tasks
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerAdmin;