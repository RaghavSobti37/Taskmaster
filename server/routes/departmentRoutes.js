const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const User = require('../models/User');
const TaskType = require('../models/TaskType');
const { protect, admin } = require('../middleware/authMiddleware');
const { seedDepartments } = require('../services/departmentService');

router.get('/public', async (req, res) => {
  try {
    let depts = await Department.find({ signupAllowed: true }).sort('sortOrder').lean();
    if (depts.length === 0) {
      await seedDepartments();
      depts = await Department.find({ signupAllowed: true }).sort('sortOrder').lean();
    }
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(protect);

router.get('/', async (req, res) => {
  try {
    let depts = await Department.find().sort('sortOrder').lean();
    if (depts.length === 0) {
      await seedDepartments();
      depts = await Department.find().sort('sortOrder').lean();
    }
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/task-types', async (req, res) => {
  try {
    const { departmentId, projectRole } = req.query;
    const filter = { isActive: true };
    const orConditions = [];
    if (departmentId) {
      orConditions.push({ departmentId }, { departmentId: null });
    }
    if (projectRole) {
      orConditions.push({ projectRole }, { projectRole: null });
    }
    if (orConditions.length) filter.$or = orConditions;
    const types = await TaskType.find(filter).sort('name').lean();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:userId', admin, async (req, res) => {
  try {
    const { departmentId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { departmentId: departmentId || null },
      { new: true }
    ).populate('departmentId', 'name slug color signupAllowed');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
