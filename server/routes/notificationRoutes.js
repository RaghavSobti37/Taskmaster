const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Lead = require('../models/Lead');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { startOfDay, endOfDay, isBefore } = require('date-fns');
const { getAllowedCategoriesForUser } = require('../utils/notificationCategories');
const { isAdminUser } = require('../utils/departmentPermissions');
const { getVapidPublicKey } = require('../services/pushNotificationService');
const { prunePushSubscriptions } = require('../utils/pushSubscriptions');
const TaskService = require('../services/TaskService');
const logger = require('../utils/logger');

router.get('/status-counts', protect, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const assignedTaskIds = await TaskAssignment.distinct('taskId', { userId: req.user._id });
    const taskScope = assignedTaskIds.length ? { _id: { $in: assignedTaskIds } } : { _id: null };

    const overdueTasksCount = await Task.countDocuments({
      ...taskScope,
      status: { $ne: 'done' },
      dueDate: { $lt: now },
    });

    const todayTasksCount = await Task.countDocuments({
      ...taskScope,
      status: { $ne: 'done' },
      dueDate: { $gte: todayStart, $lte: todayEnd },
    });

    const [followupAgg] = await Lead.aggregate([
      {
        $match: {
          assignedRepId: req.user._id,
          leadStatus: { $ne: 'Converted' },
          nextFollowupDate: { $exists: true, $ne: '' },
        },
      },
      {
        $addFields: {
          followupDate: {
            $dateFromString: {
              dateString: '$nextFollowupDate',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { followupDate: { $ne: null } } },
      {
        $group: {
          _id: null,
          today: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$followupDate', todayStart] }, { $lte: ['$followupDate', todayEnd] }] },
                1,
                0,
              ],
            },
          },
          overdue: {
            $sum: {
              $cond: [{ $lt: ['$followupDate', todayStart] }, 1, 0],
            },
          },
        },
      },
    ]);

    const overdueFollowupsCount = followupAgg?.overdue || 0;
    const todayFollowupsCount = followupAgg?.today || 0;

    const todayCalendarCount = await CalendarEvent.countDocuments({
      $or: [{ createdBy: req.user._id }, { visibility: 'public' }],
      date: { $gte: todayStart, $lte: todayEnd }
    });

    const allowed = await getAllowedCategoriesForUser(req.user);
    const unreadFilter = { recipient: req.user._id, read: false };
    if (!isAdminUser(req.user)) {
      unreadFilter.category = { $in: allowed };
    }
    const unreadNotificationsCount = await Notification.countDocuments(unreadFilter);

    const unreadByCategoryAgg = await Notification.aggregate([
      { $match: unreadFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const unreadByCategory = unreadByCategoryAgg.reduce((acc, row) => {
      if (row._id) acc[row._id] = row.count;
      return acc;
    }, {});

    const inReviewTasksCount = await Task.countDocuments({
      ...taskScope,
      status: 'in-review',
    });

    let reviewPendingCount = 0;
    try {
      const reviewQueue = await TaskService.getReviewQueue(req.user);
      reviewPendingCount = reviewQueue.length;
    } catch (reviewErr) {
      logger.warn('status-counts review queue', reviewErr?.message);
    }

    res.json({
      tasks: { overdue: overdueTasksCount, today: todayTasksCount, inReview: inReviewTasksCount },
      followups: { overdue: overdueFollowupsCount, today: todayFollowupsCount },
      calendar: { today: todayCalendarCount },
      notifications: { unread: unreadNotificationsCount, byCategory: unreadByCategory },
      review: { pending: reviewPendingCount },
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
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    const user = await User.findById(req.user._id).select('pushSubscriptions');
    const newSub = {
      endpoint,
      keys: { p256dh, auth },
      userAgent: req.headers['user-agent'] || '',
      createdAt: new Date(),
    };
    const pruned = prunePushSubscriptions(user?.pushSubscriptions || [], newSub);

    await User.findByIdAndUpdate(req.user._id, {
      $set: { pushSubscriptions: pruned },
    });

    res.json({ success: true, subscriptionCount: pruned.length });
  } catch (error) {
    logger.error('Push', 'Failed to save subscription', { error: error.message, userId: req.user?._id });
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
    if (!isAdminUser(req.user)) {
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

router.delete('/', protect, async (req, res) => {
  try {
    const allowed = await getAllowedCategoriesForUser(req.user);
    const filter = { recipient: req.user._id };
    if (!isAdminUser(req.user)) {
      filter.category = { $in: allowed };
    }
    const result = await Notification.deleteMany(filter);
    res.json({ message: 'Notifications cleared', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
