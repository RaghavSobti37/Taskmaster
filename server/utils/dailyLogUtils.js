import DailyLog from '../models/DailyLog.js';
import User from '../models/User.js';

// Create or update daily log for a user
export const logUserActivity = async (userId, action, metadata = {}) => {
  try {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[today.getDay()];

    let dailyLog = await DailyLog.findOne({ userId, date: dateOnly });

    if (!dailyLog) {
      dailyLog = new DailyLog({
        userId,
        date: dateOnly,
        day: dayName,
      });
    }

    // Add activity
    const activity = {
      action,
      description: getActivityDescription(action),
      timestamp: new Date(),
      metadata
    };

    dailyLog.activities.push(activity);

    // Update counters based on action
    if (action === 'task_created') {
      dailyLog.tasksCreated += 1;
    } else if (action === 'task_completed') {
      dailyLog.tasksCompleted += 1;
    } else if (action === 'task_updated') {
      dailyLog.tasksUpdated += 1;
    } else if (action === 'login') {
      dailyLog.loginCount += 1;
      dailyLog.lastLogin = new Date();
    }

    await dailyLog.save();
    return dailyLog;
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
};

// Get activity description
const getActivityDescription = (action) => {
  const descriptions = {
    'login': 'User logged in',
    'logout': 'User logged out',
    'task_created': 'Task created',
    'task_completed': 'Task completed',
    'task_updated': 'Task updated',
    'task_deleted': 'Task deleted',
    'profile_updated': 'Profile information updated',
    'password_changed': 'Password changed',
    'team_joined': 'Joined a team',
    'team_left': 'Left a team',
  };
  return descriptions[action] || action;
};

// Get user's daily logs for last N days
export const getUserDailyStats = async (userId, days = 7) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const dailyLogs = await DailyLog.find({
      userId,
      date: { $gte: startDate }
    }).sort({ date: -1 });

    return dailyLogs;
  } catch (error) {
    console.error('Error fetching daily logs:', error);
    return [];
  }
};

// Get today's log for user
export const getTodayLog = async (userId) => {
  try {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const dailyLog = await DailyLog.findOne({ userId, date: dateOnly });
    return dailyLog;
  } catch (error) {
    console.error('Error fetching today\'s log:', error);
    return null;
  }
};
