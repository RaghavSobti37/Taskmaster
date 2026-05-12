const Task = require('../models/Task');
const Project = require('../models/Project');
const { calculateRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');

exports.createTask = async (req, res) => {
  try {
    const taskData = { ...req.body };
    if (!taskData.projectId) delete taskData.projectId;
    
    const task = await Task.create(taskData);
    logActivity(req.user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title });
    res.status(201).json(task);
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = projectId ? { projectId } : {};
    const tasks = await Task.find(filter).populate('assignees', 'name avatar teams online');
    
    const statusWeight = { 'in-progress': 3, 'todo': 2, 'done': 1 };
    const priorityWeight = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };

    const sortedTasks = tasks.sort((a, b) => {
      const aSWeight = statusWeight[a.status] || 0;
      const bSWeight = statusWeight[b.status] || 0;
      
      if (aSWeight !== bSWeight) {
        return bSWeight - aSWeight;
      }
      
      const aPWeight = priorityWeight[a.priority] || 0;
      const bPWeight = priorityWeight[b.priority] || 0;
      
      return bPWeight - aPWeight;
    });

    res.json(sortedTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Status-Progress Linkage
    if (updates.status) {
      const progressMap = {
        'todo': 0,
        'in-progress': 25,
        'in-review': 50,
        'done': 100
      };
      updates.progress = progressMap[updates.status.toLowerCase()];
      
      if (updates.status.toLowerCase() === 'done') {
        updates.completedAt = new Date();
      } else {
        updates.completedAt = null;
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    
    if (task) {
      calculateRollup(task.projectId, task.phaseId);
      logActivity(req.user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status });
      
      if (updates.status === 'done') {
        const Log = require('../models/Log');
        await Log.create({
          userId: req.user._id,
          type: 'DAILY_LOG',
          title: `Task Finalized: ${task.title}`,
          description: `Successfully completed mission critical task within ${task.projectId || 'Global Nexus'}.`,
          projectId: task.projectId,
          taskId: task._id
        });
      }
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { status: status.toLowerCase() } },
      { new: true, runValidators: true }
    );
    if (task) {
      calculateRollup(task.projectId, task.phaseId);
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (task) {
      logActivity(req.user._id, 'DELETE_TASK', task._id, 'Task', { title: task.title });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
