const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const DepartmentChangeRequest = require('../models/DepartmentChangeRequest');
const User = require('../models/User');
const TaskType = require('../models/TaskType');
const { protect, admin } = require('../middleware/authMiddleware');
const { seedDepartments } = require('../services/departmentService');
const { createNotification } = require('../services/notificationDispatcher');

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

router.post('/change-request', async (req, res) => {
  try {
    const { requestedDepartmentId } = req.body;
    if (!requestedDepartmentId) {
      return res.status(400).json({ error: 'requestedDepartmentId is required' });
    }
    const pending = await DepartmentChangeRequest.findOne({ userId: req.user._id, status: 'pending' });
    if (pending) {
      return res.status(400).json({ error: 'You already have a pending department change request' });
    }
    const request = await DepartmentChangeRequest.create({
      userId: req.user._id,
      currentDepartmentId: req.user.departmentId,
      requestedDepartmentId,
      status: 'pending'
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/change-requests/mine', async (req, res) => {
  try {
    const requests = await DepartmentChangeRequest.find({ userId: req.user._id })
      .populate('currentDepartmentId requestedDepartmentId reviewedBy', 'name slug color')
      .sort('-createdAt');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/change-requests/pending', admin, async (req, res) => {
  try {
    const requests = await DepartmentChangeRequest.find({ status: 'pending' })
      .populate('userId', 'name email avatar')
      .populate('currentDepartmentId requestedDepartmentId', 'name slug color')
      .sort('-createdAt');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/change-requests/:id/approve', admin, async (req, res) => {
  try {
    const request = await DepartmentChangeRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ error: 'Pending request not found' });
    }
    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = req.body?.reviewNote || '';
    await request.save();

    await User.findByIdAndUpdate(request.userId, { departmentId: request.requestedDepartmentId });

    await createNotification({
      recipientId: request.userId,
      title: 'Department Change Approved',
      message: 'Your department change request has been approved.',
      category: 'department',
      actionUrl: '/settings'
    });

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/change-requests/:id/reject', admin, async (req, res) => {
  try {
    const request = await DepartmentChangeRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ error: 'Pending request not found' });
    }
    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = req.body?.reviewNote || '';
    await request.save();

    await createNotification({
      recipientId: request.userId,
      title: 'Department Change Rejected',
      message: request.reviewNote || 'Your department change request was not approved.',
      category: 'department',
      actionUrl: '/settings'
    });

    res.json(request);
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
    ).populate('departmentId', 'name slug color');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
