const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const CalendarEvent = require('../models/CalendarEvent');
const { protect } = require('../middleware/authMiddleware');
const { parse, startOfDay, endOfDay, isBefore } = require('date-fns');

// Get status counts for overdue items and today's items
router.get('/status-counts', protect, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // 1. Overdue Tasks
    const overdueTasksCount = await Task.countDocuments({
      assignees: req.user._id,
      status: { $ne: 'done' },
      dueDate: { $lt: now }
    });

    // 2. Tasks Due Today
    const todayTasksCount = await Task.countDocuments({
      assignees: req.user._id,
      status: { $ne: 'done' },
      dueDate: { $gte: todayStart, $lte: todayEnd }
    });

    // 3. Overdue and Today Followups (Leads)
    // Since nextFollowupDate is a string, we might need a more complex query or fetch and filter
    // For now, let's fetch leads assigned to user and filter
    const leads = await Lead.find({
      assignedRepId: req.user._id,
      leadStatus: { $ne: 'Converted' },
      nextFollowupDate: { $exists: true, $ne: '' }
    });

    let overdueFollowupsCount = 0;
    let todayFollowupsCount = 0;

    leads.forEach(lead => {
      try {
        // Parse DD-MM-YYYY or similar. The model says string.
        // FollowupsPage.jsx uses new Date(lead.nextFollowupDate)
        const followupDate = new Date(lead.nextFollowupDate);
        if (isNaN(followupDate.getTime())) return;

        if (followupDate >= todayStart && followupDate <= todayEnd) {
          todayFollowupsCount++;
        } else if (followupDate < now) {
          overdueFollowupsCount++;
        }
      } catch (e) {}
    });

    // 4. Calendar Events Today
    const todayCalendarCount = await CalendarEvent.countDocuments({
      $or: [
        { createdBy: req.user._id },
        { visibility: 'public' }
      ],
      date: { $gte: todayStart, $lte: todayEnd }
    });
    
    // 5. Unread Notifications
    const unreadNotificationsCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({
      tasks: {
        overdue: overdueTasksCount,
        today: todayTasksCount
      },
      followups: {
        overdue: overdueFollowupsCount,
        today: todayFollowupsCount
      },
      calendar: {
        today: todayCalendarCount
      },
      notifications: {
        unread: unreadNotificationsCount
      }
    });
  } catch (error) {
    console.error('Status counts error:', error);
    res.status(500).json({ error: 'Failed to fetch status counts' });
  }
});

// Get all notifications for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort('-createdAt')
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
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

// Mark all as read
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
