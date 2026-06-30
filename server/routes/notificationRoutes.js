const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, admin } = require('../middleware/authMiddleware');
const { startOfDay, endOfDay } = require('date-fns');
const { getAllowedCategoriesForUser } = require('../utils/notificationCategories');
const { getVapidPublicKey, broadcastTestPush } = require('../services/pushNotificationService');
const { prunePushSubscriptions } = require('../utils/pushSubscriptions');
const TaskService = require('../services/TaskService');
const logger = require('../utils/logger');
const { validateBody } = require('../validation/validateBody');
const { FOLLOWUP_DATE_FIELD } = require('../utils/followupDateQuery');
const { pushSubscribeBody, pushUnsubscribeBody } = require('../validation/schemas/notifications');
const { aggregateWithTenant } = require('../repositories/aggregateWithTenant');
const { countProjectOverdueTasks, buildUserTodoStatsFilter } = require('../utils/projectStatusCounts');
const { getCache, setCache } = require('../services/cacheService');

const STATUS_COUNTS_TTL_SECONDS = 20;

router.get('/status-counts', protect, async (req, res) => {
  try {
    const cacheKey = `status-counts:v2:${req.user._id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const todoStatsBase = await buildUserTodoStatsFilter(req.user._id);
    const todoStats = await TaskService.getTodoStats(todoStatsBase);
    const overdueTasksCount = todoStats.overdue || 0;
    const todayTasksCount = todoStats.today || 0;
    const inReviewTasksCount = todoStats.inReview || 0;

    const [followupAgg] = await aggregateWithTenant(Lead, [
      {
        $match: {
          assignedRepId: req.user._id,
          leadStatus: { $ne: 'Converted' },
          nextFollowupDate: { $exists: true, $ne: '' },
        },
      },
      { $addFields: FOLLOWUP_DATE_FIELD },
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

    let reviewPendingCount = 0;
    let projectReviewCount = 0;
    try {
      const reviewCounts = await TaskService.countReviewQueue(req.user);
      reviewPendingCount = reviewCounts.pending;
      projectReviewCount = reviewCounts.projectReview;
    } catch (reviewErr) {
      logger.warn('status-counts review queue', reviewErr?.message);
    }

    let projectOverdueCount = 0;
    try {
      projectOverdueCount = await countProjectOverdueTasks(req.user);
    } catch (projectErr) {
      logger.warn('status-counts project overdue', projectErr?.message);
    }

    const allowed = await getAllowedCategoriesForUser(req.user);

    const unreadNotifications = await Notification.find({
      recipient: req.user._id,
      read: false,
    }).select('category').lean();
    const unreadByCategory = {};
    for (const row of unreadNotifications) {
      if (row.category) unreadByCategory[row.category] = (unreadByCategory[row.category] || 0) + 1;
    }

    const payload = {
      tasks: { overdue: overdueTasksCount, today: todayTasksCount, inReview: inReviewTasksCount },
      followups: { overdue: overdueFollowupsCount, today: todayFollowupsCount },
      calendar: { today: todayCalendarCount },
      notifications: {
        unread: unreadNotifications.length,
        byCategory: unreadByCategory,
        localOnly: false,
        allowedCategories: ['all', ...allowed],
      },
      review: { pending: reviewPendingCount },
      projects: { overdue: projectOverdueCount, review: projectReviewCount },
    };

    await setCache(cacheKey, payload, STATUS_COUNTS_TTL_SECONDS);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status counts' });
  }
});

router.get('/push/vapid-key', protect, (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/push/subscribe', protect, validateBody(pushSubscribeBody), async (req, res) => {
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

router.delete('/push/unsubscribe', protect, validateBody(pushUnsubscribeBody), async (req, res) => {
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

router.post('/push/test-broadcast', protect, admin, async (req, res) => {
  try {
    const result = await broadcastTestPush();
    if (!result.ok) {
      return res.status(503).json({ error: result.error || 'Push broadcast unavailable' });
    }
    logger.info('Push', 'Test broadcast sent', {
      actorId: req.user._id,
      users: result.users,
      devices: result.devices,
      notificationId: result.notificationId,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Push', 'Test broadcast failed', { error: error.message, actorId: req.user?._id });
    res.status(500).json({ error: 'Failed to send test push broadcast' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const allowed = await getAllowedCategoriesForUser(req.user);
    const user = await User.findById(req.user._id).populate('departmentId', 'slug name');
    const rows = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('actorId', 'name avatar')
      .lean();

    const notifications = rows.map((row) => ({
      ...row,
      _id: row._id?.toString?.() || String(row._id),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }));

    res.json({
      notifications,
      localOnly: false,
      allowedCategories: ['all', ...allowed],
      departmentSlug: user?.departmentId?.slug || '',
    });
  } catch (error) {
    logger.error('Notifications', 'List failed', { error: error.message, userId: req.user?._id });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true },
    );
    if (!doc) return res.status(404).json({ error: 'Notification not found' });
    res.json({ _id: doc._id.toString(), read: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

router.delete('/', protect, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ recipient: req.user._id });
    res.json({ message: 'Notifications cleared', deletedCount: result.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
