import TaskLog from '../models/TaskLog.js';

// Get all daily logs for a user
export const getDailyLogs = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const logs = await TaskLog.find({ userId })
      .sort({ date: -1 })
      .populate('userId', 'username email');

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching daily logs', error: error.message });
  }
};

// Get daily log for a specific date
export const getDailyLogByDate = async (req, res) => {
  try {
    const { userId, date } = req.query;

    if (!userId || !date) {
      return res.status(400).json({ message: 'User ID and date are required' });
    }

    const log = await TaskLog.findOne({
      userId,
      date: date
    }).populate('userId', 'username email');

    res.status(200).json(log || null);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching daily log', error: error.message });
  }
};

// Create or update a daily log
export const saveOrUpdateDailyLog = async (req, res) => {
  try {
    const { userId, date, tasks, totalHours, notes } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ message: 'User ID and date are required' });
    }

    // Find existing log for this date
    let log = await TaskLog.findOne({
      userId,
      date: date
    });

    if (log) {
      // Update existing log
      log.tasks = tasks || log.tasks;
      log.totalHours = totalHours || 0;
      log.notes = notes || log.notes;
    } else {
      // Create new log
      log = new TaskLog({
        userId,
        date: date,
        tasks: tasks || [],
        totalHours: totalHours || 0,
        notes: notes || ''
      });
    }

    await log.save();
    await log.populate('userId', 'username email');

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ message: 'Error saving daily log', error: error.message });
  }
};

// Add a task to daily log
export const addTaskToLog = async (req, res) => {
  try {
    const { userId, date, task } = req.body;

    if (!userId || !date || !task) {
      return res.status(400).json({ message: 'User ID, date, and task are required' });
    }

    let log = await TaskLog.findOne({
      userId,
      date: date
    });

    if (!log) {
      log = new TaskLog({
        userId,
        date: date,
        tasks: [task],
        totalHours: task.hoursSpent || 0
      });
    } else {
      log.tasks.push(task);
      log.totalHours = (log.totalHours || 0) + (task.hoursSpent || 0);
    }

    await log.save();
    await log.populate('userId', 'username email');

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ message: 'Error adding task to log', error: error.message });
  }
};

// Delete a task from daily log
export const deleteTaskFromLog = async (req, res) => {
  try {
    const { userId, date, taskIndex } = req.body;

    if (!userId || !date || taskIndex === undefined) {
      return res.status(400).json({ message: 'User ID, date, and task index are required' });
    }

    const log = await TaskLog.findOne({
      userId,
      date: date
    });

    if (!log) {
      return res.status(404).json({ message: 'Daily log not found' });
    }

    if (taskIndex < 0 || taskIndex >= log.tasks.length) {
      return res.status(400).json({ message: 'Invalid task index' });
    }

    const deletedTask = log.tasks.splice(taskIndex, 1)[0];
    log.totalHours -= deletedTask.hoursSpent || 0;
    log.totalHours = Math.max(0, log.totalHours);

    await log.save();
    await log.populate('userId', 'username email');

    res.status(200).json(log);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task from log', error: error.message });
  }
};

// Get daily log statistics
export const getDailyLogStats = async (req, res) => {
  try {
    const { userId, days = 30 } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const logs = await TaskLog.find({
      userId,
      date: { $gte: startDateStr }
    }).sort({ date: -1 });

    const stats = {
      totalDays: logs.length,
      totalHours: logs.reduce((sum, log) => sum + (log.totalHours || 0), 0),
      totalTasks: logs.reduce((sum, log) => sum + (log.tasks?.length || 0), 0),
      averageHoursPerDay: 0,
      averageTasksPerDay: 0,
      mostProductiveDay: null,
      completionRate: 0
    };

    if (logs.length > 0) {
      stats.averageHoursPerDay = stats.totalHours / logs.length;
      stats.averageTasksPerDay = stats.totalTasks / logs.length;

      // Find most productive day
      let maxHours = 0;
      logs.forEach(log => {
        if (log.totalHours > maxHours) {
          maxHours = log.totalHours;
          stats.mostProductiveDay = log.date;
        }
      });

      // Calculate completion rate
      const completedTasks = logs.reduce(
        (sum, log) => 
          sum + (log.tasks?.filter(t => t.status === 'completed').length || 0),
        0
      );
      stats.completionRate = stats.totalTasks > 0 ? (completedTasks / stats.totalTasks) * 100 : 0;
    }

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
};
