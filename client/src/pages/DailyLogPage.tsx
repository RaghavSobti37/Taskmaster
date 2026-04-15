import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './DailyLogPage.css';

interface DailyLogEntry {
  _id?: string;
  date: string;
  userId: string | object;
  tasks: {
    taskId: string;
    taskTitle: string;
    hoursSpent: number;
    status: 'completed' | 'in_progress' | 'blocked' | 'pending';
    description: string;
    completedAt?: string;
  }[];
  totalHours: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

const DailyLogPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [currentLog, setCurrentLog] = useState<DailyLogEntry | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    taskTitle: '',
    hoursSpent: 1,
    status: 'in_progress' as const,
    description: ''
  });
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/daily-logs', {
          params: { userId: user?._id }
        });
        setDailyLogs(response.data);

        // Load today's log
        const todayLog = response.data.find(
          (log: DailyLogEntry) => log.date === selectedDate
        );
        setCurrentLog(todayLog || null);
        setNotes(todayLog?.notes || '');
      } catch (error) {
        console.error('Failed to fetch daily logs', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?._id) {
      fetchLogs();
    }
  }, [selectedDate, user?._id]);

  const handleAddTask = async () => {
    if (!newTask.taskTitle.trim()) return;
    if (newTask.hoursSpent <= 0) {
      alert('Hours spent must be greater than 0 before saving.');
      return;
    }

    try {
      const logData = {
        date: selectedDate,
        userId: user?._id,
        tasks: currentLog?.tasks
          ? [...currentLog.tasks, newTask]
          : [newTask],
        totalHours: (currentLog?.totalHours || 0) + newTask.hoursSpent,
        notes
      };

      const response = await api.post('/daily-logs', logData);
      setCurrentLog(response.data);
      setNewTask({ taskTitle: '', hoursSpent: 1, status: 'in_progress', description: '' });
      setIsAddingTask(false);
    } catch (error) {
      console.error('Failed to add task', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentLog) return;

    try {
      const updatedTasks = currentLog.tasks.filter((_, idx) => taskId !== idx.toString());
      const totalHours = updatedTasks.reduce((sum, task) => sum + task.hoursSpent, 0);

      const logData = {
        date: selectedDate,
        userId: user?._id,
        tasks: updatedTasks,
        totalHours,
        notes
      };

      const response = await api.post('/daily-logs', logData);
      setCurrentLog(response.data);
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleSaveNotes = async () => {
    try {
      const logData = {
        date: selectedDate,
        userId: user?._id,
        tasks: currentLog?.tasks || [],
        totalHours: currentLog?.totalHours || 0,
        notes
      };

      const response = await api.post('/daily-logs', logData);
      setCurrentLog(response.data);
    } catch (error) {
      console.error('Failed to save notes', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 text-green-700 dark:text-green-300';
      case 'in_progress':
        return 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-700 dark:text-blue-300';
      case 'blocked':
        return 'from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 text-red-700 dark:text-red-300';
      case 'pending':
        return 'from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-800/20 text-yellow-700 dark:text-yellow-300';
      default:
        return 'from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '⚙️';
      case 'blocked':
        return '🚫';
      case 'pending':
        return '⏳';
      default:
        return '📋';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="daily-log-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="daily-log-container mb-12"
      >
        <div className="daily-log-header">
          <h1><span className="emoji">📋</span>Daily Log</h1>
          <p style={{ margin: 0, fontSize: '18px', color: '#666', fontWeight: 500 }}>
            Track your daily progress like an MNC logging system
          </p>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="daily-log-container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="daily-log-grid"
        >
          {/* Sidebar - Calendar & Stats */}
          <motion.div variants={itemVariants} className="daily-log-sidebar">
            <div className="glass-container">
              {/* Date Selector */}
              <div style={{ marginBottom: '24px' }}>
                <label className="date-picker-wrapper-label">
                  📅 Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="date-picker"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Stats */}
              <div style={{ paddingTop: '24px', borderTop: '2px solid rgba(183, 75, 2, 0.1)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#666', marginBottom: '16px', margin: 0 }}>
                  📊 Today's Stats
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="stats-card">
                    <p className="stats-label">Total Tasks</p>
                    <p className="stats-value">{currentLog?.tasks.length || 0}</p>
                  </div>

                  <div className="stats-card">
                    <p className="stats-label">Total Hours</p>
                    <p className="stats-value">{currentLog?.totalHours || 0}h</p>
                  </div>

                  <div className="stats-card">
                    <p className="stats-label">Completed</p>
                    <p className="stats-value">{currentLog?.tasks.filter(t => t.status === 'completed').length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Productivity Score */}
              <div style={{ paddingTop: '24px', borderTop: '2px solid rgba(183, 75, 2, 0.1)', marginTop: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#666', marginBottom: '12px', margin: 0 }}>
                  🎯 Productivity
                </p>
                <div className="progress-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: currentLog
                        ? `${(currentLog.tasks.filter(t => t.status === 'completed').length / currentLog.tasks.length) * 100 || 0}%`
                        : '0%'
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="progress-fill"
                  />
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: 0 }}>
                  {currentLog && currentLog.tasks.length > 0
                    ? `${Math.round((currentLog.tasks.filter(t => t.status === 'completed').length / currentLog.tasks.length) * 100)}% completed`
                    : 'No tasks logged'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Main Content Area */}
          <motion.div variants={itemVariants} className="task-entry-section">
            <div className="glass-container">
              {/* Add New Task Section */}
              {!isAddingTask ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddingTask(true)}
                  className="btn-add-task"
                >
                  + Add Today's Task
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="task-form"
                >
                  <h3 className="task-form-header">➕ Log New Task</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Task Title */}
                    <div className="form-group">
                      <label>Task Title</label>
                      <input
                        type="text"
                        value={newTask.taskTitle}
                        onChange={(e) =>
                          setNewTask({ ...newTask, taskTitle: e.target.value })
                        }
                        placeholder="e.g., API Development, Testing, Debugging"
                      />
                    </div>

                    {/* Hours & Status Row */}
                    <div className="form-row">
                      <div className="form-group">
                        <label>Hours Spent</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={newTask.hoursSpent}
                          onChange={(e) => {
                            const parsedHours = parseFloat(e.target.value);
                            setNewTask({
                              ...newTask,
                              hoursSpent: Number.isNaN(parsedHours) ? 0 : parsedHours
                            });
                          }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Status</label>
                        <select
                          value={newTask.status}
                          onChange={(e) =>
                            setNewTask({
                              ...newTask,
                              status: e.target.value as any
                            })
                          }
                        >
                          <option value="pending">⏳ Pending</option>
                          <option value="in_progress">⚙️ In Progress</option>
                          <option value="completed">✅ Completed</option>
                          <option value="blocked">🚫 Blocked</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-group form-row full">
                      <label>Description (Optional)</label>
                      <textarea
                        value={newTask.description}
                        onChange={(e) =>
                          setNewTask({ ...newTask, description: e.target.value })
                        }
                        placeholder="Add any additional notes..."
                        style={{ minHeight: '100px', maxHeight: '150px' }}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '2px solid rgba(183, 75, 2, 0.1)' }}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setIsAddingTask(false);
                          setNewTask({
                            taskTitle: '',
                            hoursSpent: 1,
                            status: 'in_progress',
                            description: ''
                          });
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: '#e5e5e5',
                          color: '#333',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAddTask}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: 'linear-gradient(135deg, #b74b02 0%, #d67a3a 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(183, 75, 2, 0.3)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Save Task
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tasks List */}
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', margin: 0 }}>
                  📌 Today's Tasks ({currentLog?.tasks.length || 0})
                </h3>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="task-list"
                >
                  <AnimatePresence>
                    {currentLog && currentLog.tasks.length > 0 ? (
                      currentLog.tasks.map((task, idx) => (
                        <motion.div
                          key={idx}
                          variants={itemVariants}
                          exit={{ opacity: 0, x: 20 }}
                          className="task-item"
                        >
                          <div style={{ flex: 1 }}>
                            <h4 className="task-title">{task.taskTitle}</h4>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                              {/* Status Badge */}
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                className={`status-badge status-${task.status}`}
                              >
                                {getStatusIcon(task.status)} {task.status.replace('_', ' ')}
                              </motion.div>

                              {/* Hours Badge */}
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                style={{
                                  display: 'inline-block',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: 'rgba(25, 103, 210, 0.15)',
                                  color: '#1967d2'
                                }}
                              >
                                ⏱️ {task.hoursSpent}h
                              </motion.div>
                            </div>

                            {task.description && (
                              <p style={{ fontSize: '13px', color: '#666', marginBottom: 0 }}>
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Delete Button */}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteTask(idx.toString())}
                            style={{
                              flexShrink: 0,
                              padding: '8px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#dc3545',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </motion.button>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        style={{ textAlign: 'center', paddingTop: '48px', paddingBottom: '48px', color: '#999' }}
                      >
                        <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>No tasks logged for today</p>
                        <p style={{ fontSize: '13px', margin: 0 }}>Start by adding your first task!</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Daily Notes */}
              <div className="notes-section">
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px' }}>
                  📝 Daily Notes
                </h3>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes, blockers, or observations for the day..."
                  className="notes-textarea"
                />

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveNotes}
                  className="btn-save-notes"
                >
                  Save Notes
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Past Logs Summary */}
        {dailyLogs.length > 1 && (
          <motion.div variants={itemVariants} style={{ marginTop: '24px' }}>
            <div className="glass-container">
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', margin: 0 }}>
                📊 Past Logs Summary
              </h3>

              <div className="past-logs-grid">
                {dailyLogs.slice(-5).reverse().map((log, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.05, y: -4 }}
                    onClick={() => setSelectedDate(log.date)}
                    className="past-log-card"
                  >
                    <p className="past-log-date">
                      {new Date(log.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                          {log.tasks.length}
                        </span>{' '}
                        tasks
                      </p>
                      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                          {log.totalHours}h
                        </span>{' '}
                        logged
                      </p>
                      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        <span style={{ fontWeight: 700, color: '#2e7d32' }}>
                          {log.tasks.filter(t => t.status === 'completed').length}
                        </span>{' '}
                        completed
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DailyLogPage;
