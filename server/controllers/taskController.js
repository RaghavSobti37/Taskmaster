const Task = require('../models/Task');
const Project = require('../models/Project');
const { calculateRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');

const ALLOWED_CREATE = ['title','description','status','priority','projectId','phaseId','parentTaskId','assignees','startDate','dueDate','duration','plannedHours','actualHours','progress','dependencies'];
const ALLOWED_UPDATE = ['title','description','status','priority','phaseId','assignees','startDate','dueDate','duration','plannedHours','actualHours','progress','dependencies'];

const pick = (src, keys) => {
  const r = {};
  for (const k of keys) { if (src[k] !== undefined) r[k] = src[k]; }
  return r;
};

exports.createTask = async (req, res) => {
  try {
    const taskData = { ...pick(req.body, ALLOWED_CREATE), createdBy: req.user._id };
    if (!taskData.projectId) delete taskData.projectId;
    const task = await Task.create(taskData);
    if (task.projectId) {
      await Project.findByIdAndUpdate(task.projectId, { $inc: { totalTasksCount: 1 } });
    }
    logActivity(req.user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title });
    res.status(201).json(task);
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = { createdBy: req.user._id };
    if (projectId) filter.projectId = projectId;
    const tasks = await Task.find(filter)
      .select('title status priority projectId assignees progress dueDate')
      .populate('assignees', 'name avatar')
      .lean();
    const sw = { 'in-progress': 3, 'todo': 2, 'done': 1 };
    const pw = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    tasks.sort((a, b) => (sw[b.status]||0) - (sw[a.status]||0) || (pw[b.priority]||0) - (pw[a.priority]||0));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const isOwner = existing.createdBy?.toString() === req.user._id.toString();
    const isAssignee = existing.assignees?.some(a => a.toString() === req.user._id.toString());
    if (!isOwner && !isAssignee && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }
    const updates = pick(req.body, ALLOWED_UPDATE);
    if (updates.status) {
      if (updates.status.toLowerCase() === 'done') {
        updates.completedAt = new Date();
        updates.progress = 100;
      } else {
        updates.completedAt = null;
      }
    }
    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json(task);
    if (task) {
      setImmediate(async () => {
        try {
          calculateRollup(task.projectId, task.phaseId);
          logActivity(req.user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status });
          if (updates.status === 'done') {
            const Log = require('../models/Log');
            let proj = 'Global Nexus';
            if (task.projectId) { const p = await Project.findById(task.projectId); if (p) proj = p.name; }
            await Log.create({ userId: req.user._id, action: 'DAILY_LOG', details: { type: 'TASK_COMPLETION', title: `Task Finalized: ${task.title}`, message: `Successfully completed mission critical task within ${proj}.`, project: proj, timeSpent: task.actualHours > 0 ? `${task.actualHours}h` : (task.plannedHours > 0 ? `${task.plannedHours}h` : '1h') }, targetId: task._id, targetType: 'Task' });
            if (task.projectId) await Project.findByIdAndUpdate(task.projectId, { $inc: { completedTasksCount: 1 } });
          }
        } catch (err) { console.error('Post-update side effect error:', err); }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this task' });
    }
    const task = await Task.findByIdAndDelete(req.params.id);
    if (task) {
      if (task.projectId) {
        const dec = { totalTasksCount: -1 };
        if (task.status === 'done') dec.completedTasksCount = -1;
        await Project.findByIdAndUpdate(task.projectId, { $inc: dec });
      }
      logActivity(req.user._id, 'DELETE_TASK', task._id, 'Task', { title: task.title });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
};
