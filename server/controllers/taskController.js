const Task = require('../models/Task');
const Project = require('../models/Project');
const { calculateRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');

exports.createTask = async (req, res) => {
  try {
    const taskData = { ...req.body };
    if (!taskData.projectId) delete taskData.projectId;
    
    const task = await Task.create(taskData);
    
    // Side effect - increment project task count
    if (task.projectId) {
      await Project.findByIdAndUpdate(task.projectId, { $inc: { totalTasksCount: 1 } });
    }

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
    const tasks = await Task.find(filter)
      .select('title status priority projectId assignees progress dueDate')
      .populate('assignees', 'name avatar')
      .lean();
    
    const statusWeight = { 'in-progress': 3, 'todo': 2, 'done': 1 };
    const priorityWeight = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };

    tasks.sort((a, b) => {
      const aSWeight = statusWeight[a.status] || 0;
      const bSWeight = statusWeight[b.status] || 0;
      
      if (aSWeight !== bSWeight) {
        return bSWeight - aSWeight;
      }
      
      const aPWeight = priorityWeight[a.priority] || 0;
      const bPWeight = priorityWeight[b.priority] || 0;
      
      return bPWeight - aPWeight;
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Status-Progress Linkage
    // Status-based metadata linkage
    if (updates.status) {
      if (updates.status.toLowerCase() === 'done') {
        updates.completedAt = new Date();
        updates.progress = 100; // Force 100% on completion
      } else if (updates.status.toLowerCase() !== 'done') {
        updates.completedAt = null;
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    
    res.json(task);

    // SIDE EFFECTS - Processed after response for zero-latency feel
    if (task) {
      // Fire and forget optimizations
      setImmediate(async () => {
        try {
          const { calculateRollup } = require('../utils/rollup');
          calculateRollup(task.projectId, task.phaseId);
          
          logActivity(req.user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status });
          
          if (updates.status === 'done') {
            const Log = require('../models/Log');
            await Log.create({
              userId: req.user._id,
              action: 'DAILY_LOG',
              details: { 
                type: 'TASK_COMPLETION',
                title: `Task Finalized: ${task.title}`,
                message: `Successfully completed mission critical task within ${task.projectId || 'Global Nexus'}.`
              },
              targetId: task._id,
              targetType: 'Task'
            });

            // Atomic Increment for Project completion count
            if (task.projectId) {
              await Project.findByIdAndUpdate(task.projectId, { $inc: { completedTasksCount: 1 } });
            }
          }
        } catch (err) {
          console.error('Post-update side effect error:', err);
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (task) {
      // Side effect - decrement project task count
      if (task.projectId) {
        const dec = { totalTasksCount: -1 };
        if (task.status === 'done') dec.completedTasksCount = -1;
        await Project.findByIdAndUpdate(task.projectId, { $inc: dec });
      }
      logActivity(req.user._id, 'DELETE_TASK', task._id, 'Task', { title: task.title });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
