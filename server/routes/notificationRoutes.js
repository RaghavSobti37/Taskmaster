const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Lead = require('../models/Lead');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { startOfDay, endOfDay, isBefore } = require('date-fns');
const { getAllowedCategoriesForUser } = require('../utils/notificationCategories');
const { getVapidPublicKey } = require('../services/pushNotificationService');
const { prunePushSubscriptions } = require('../utils/pushSubscriptions');
const TaskService = require('../services/TaskService');
const logger = require('../utils/logger');
const { validateBody } = require('../validation/validateBody');
const { FOLLOWUP_DATE_FIELD } = require('../utils/followupDateQuery');
const { pushSubscribeBody, pushUnsubscribeBody } = require('../validation/schemas/notifications');
const { aggregateWithTenant } = require('../repositories/aggregateWithTenant');
const { countProjectOverdueTasks, countProjectReviewTasks } = require('../utils/projectStatusCounts');

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

    const inReviewTasksCount = await Task.countDocuments({
      ...taskScope,
      status: 'in-review',
    });

    let reviewPendingCount = 0;
    let projectReviewCount = 0;
    let reviewQueue = [];
    try {
      reviewQueue = await TaskService.getReviewQueue(req.user);
      reviewPendingCount = reviewQueue.length;
      projectReviewCount = countProjectReviewTasks(reviewQueue);
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

    res.json({
      tasks: { overdue: overdueTasksCount, today: todayTasksCount, inReview: inReviewTasksCount },
      followups: { overdue: overdueFollowupsCount, today: todayFollowupsCount },
      calendar: { today: todayCalendarCount },
      notifications: { unread: 0, byCategory: {}, localOnly: true, allowedCategories: ['all', ...allowed] },
      review: { pending: reviewPendingCount },
      projects: { overdue: projectOverdueCount, review: projectReviewCount },
    });
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

router.get('/', protect, async (req, res) => {
  try {
    const allowed = await getAllowedCategoriesForUser(req.user);
    const user = await User.findById(req.user._id).populate('departmentId', 'slug name');
    res.json({
      notifications: [],
      localOnly: true,
      allowedCategories: ['all', ...allowed],
      departmentSlug: user?.departmentId?.slug || '',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  res.json({ _id: req.params.id, read: true, localOnly: true });
});

router.patch('/read-all', protect, async (req, res) => {
  res.json({ message: 'All notifications marked as read', localOnly: true });
});

router.delete('/', protect, async (req, res) => {
  res.json({ message: 'Notifications cleared', deletedCount: 0, localOnly: true });
});

module.exports = router;
