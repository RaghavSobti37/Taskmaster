const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { startOfDay, endOfDay, isBefore } = require('date-fns');
const { getAllowedCategoriesForUser } = require('../utils/notificationCategories');
const { getVapidPublicKey } = require('../services/pushNotificationService');

router.get('/status-counts', protect, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const overdueTasksCount = await Task.countDocuments({
      assignees: req.user._id,
      status: { $ne: 'done' },
      dueDate: { $lt: now }
    });

    const todayTasksCount = await Task.countDocuments({
      assignees: req.user._id,
      status: { $ne: 'done' },
      dueDate: { $gte: todayStart, $lte: todayEnd }
    });

    const leads = await Lead.find({
      assignedRepId: req.user._id,
      leadStatus: { $ne: 'Converted' },
      nextFollowupDate: { $exists: true, $ne: '' }
    });

    let overdueFollowupsCount = 0;
    let todayFollowupsCount = 0;

    leads.forEach((lead) => {
      try {
        const followupDate = new Date(lead.nextFollowupDate);
        if (isNaN(followupDate.getTime())) return;
        if (followupDate >= todayStart && followupDate <= todayEnd) todayFollowupsCount++;
        else if (followupDate < now) overdueFollowupsCount++;
      } catch (e) {}
    });

    const todayCalendarCount = await CalendarEvent.countDocuments({
      $or: [{ createdBy: req.user._id }, { visibility: 'public' }],
      date: { $gte: todayStart, $lte: todayEnd }
    });

    const allowed = await getAllowedCategoriesForUser(req.user);
    const unreadFilter = { recipient: req.user._id, read: false };
    if (req.user.role !== 'admin') {
      unreadFilter.category = { $in: allowed };
    }
    const unreadNotificationsCount = await Notification.countDocuments(unreadFilter);

    res.json({
      tasks: { overdue: overdueTasksCount, today: todayTasksCount },
      followups: { overdue: overdueFollowupsCount, today: todayFollowupsCount },
      calendar: { today: todayCalendarCount },
      notifications: { unread: unreadNotificationsCount }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status counts' });
  }
});

router.get('/push/vapid-key', protect, (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/push/subscribe', protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const user = await User.findById(req.user._id);
    user.pushSubscriptions = user.pushSubscriptions || [];
    user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.endpoint !== subscription.endpoint);
    user.pushSubscriptions.push({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: req.headers['user-agent'] || ''
    });
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.delete('/push/unsubscribe', protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint } }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const allowed = await getAllowedCategoriesForUser(req.user);
    const filter = { recipient: req.user._id };
    if (req.user.role !== 'admin') {
      filter.category = { $in: allowed };
    }

    const notifications = await Notification.find(filter)
      .sort('-createdAt')
      .limit(50)
      .populate('actorId', 'name avatar')
      .populate('relatedProjectId', 'name color');

    const user = await User.findById(req.user._id).populate('departmentId', 'slug name');
    res.json({
      notifications,
      allowedCategories: ['all', ...allowed],
      departmentSlug: user?.departmentId?.slug || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
