const Task = require('../models/Task');
const Project = require('../models/Project');
const { calculateRollup } = require('../utils/rollup');

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      projectId: req.body.projectId
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = projectId ? { projectId } : {};
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (task) {
      // Trigger async roll-up
      calculateRollup(task.projectId, task.phaseId);
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
