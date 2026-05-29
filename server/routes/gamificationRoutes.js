const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const DailyMission = require('../models/DailyMission');
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const { getCurrentWeekRange } = require('../utils/attendanceDate');

const ACTION_LABELS = {
  COMPLETE_TASK: 'Completed task',
  CREATE_TASK: 'Created task',
  CREATE_PROJECT: 'Created project',
  MISSION_COMPLETE: 'Completed mission',
  CALENDAR_EVENT_CREATED: 'Created calendar event',
  ATTENDANCE_ACTION: 'Marked attendance action',
  ATTENDANCE_CHECKIN_WINDOW: 'Checked in on time',
  ATTENDANCE_CHECKOUT_WINDOW: 'Checked out on time',
  LEAVE_APPLIED: 'Applied leave',
  ANNOUNCEMENT_CREATED: 'Created announcement'
};

const toSimpleMessage = (log) => {
  const base = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase();
  if (log.action === 'MISSION_COMPLETE' && log.details?.title) {
    return `${base}: ${log.details.title}`;
  }
  if (log.action === 'ATTENDANCE_ACTION' && log.details?.type) {
    return `${base} (${log.details.type === 'in' ? 'check-in' : 'check-out'})`;
  }
  return base;
};

// Get active missions
router.get('/missions', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Auto-generate if missing
    await GamificationService.generateDailyMissions(req.user._id);

    const missions = await DailyMission.find({
      userId: req.user._id,
      date: { $gte: today }
    });

    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user progress details
router.get('/progress', protect, async (req, res) => {
  try {
    const user = req.user;
    const currentLevelExp = GamificationService.getExpForLevel(user.level || 1);
    const nextLevelExp = GamificationService.getExpForLevel((user.level || 1) + 1);

    res.json({
      level: user.level || 1,
      exp: user.exp || 0,
      currentLevelExp,
      nextLevelExp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard: top users by XP (basic weekly view)
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const XPAuditLog = require('../models/XPAuditLog');
    const User = require('../models/User');
    const { weekStart, weekEnd } = getCurrentWeekRange();

    const leaderboard = await XPAuditLog.aggregate([
      { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
      { $group: { _id: '$userId', weeklyXp: { $sum: '$amount' } } },
      { $sort: { weeklyXp: -1 } },
      { $limit: 10 }
    ]);

    const userIds = leaderboard.map((entry) => entry._id);
    const users = await User.find({ _id: { $in: userIds } }, 'name avatar xp level').lean();
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    const top = leaderboard.map((entry, index) => ({
      rank: index + 1,
      weeklyXp: entry.weeklyXp,
      ...(usersById.get(String(entry._id)) || { _id: entry._id, name: 'Unknown' })
    }));

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard detail: simple weekly XP calculation for one user
router.get('/leaderboard/:userId/breakdown', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const XPAuditLog = require('../models/XPAuditLog');
    const User = require('../models/User');

    const { weekStart, weekEnd } = getCurrentWeekRange();

    const logs = await XPAuditLog.find({
      userId,
      createdAt: { $gte: weekStart, $lte: weekEnd }
    })
      .sort({ createdAt: -1 })
      .lean();

    const user = await User.findById(userId, 'name avatar level xp').lean();

    const groupedMap = new Map();
    for (const log of logs) {
      const key = `${log.action}::${log.amount}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          action: log.action,
          actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
          amountPerAction: log.amount,
          count: 0,
          totalXp: 0,
          sampleMessage: toSimpleMessage(log)
        });
      }
      const group = groupedMap.get(key);
      group.count += 1;
      group.totalXp += log.amount;
    }

    const groupedBreakdown = Array.from(groupedMap.values()).sort((a, b) => b.totalXp - a.totalXp);
    const totalXp = logs.reduce((sum, item) => sum + (item.amount || 0), 0);

    res.json({
      user: user || { _id: userId, name: 'Unknown' },
      weekStart,
      weekEnd,
      totalXp,
      groupedBreakdown,
      recentLogs: logs.slice(0, 15).map((log) => ({
        _id: log._id,
        amount: log.amount,
        action: log.action,
        actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
        message: toSimpleMessage(log),
        createdAt: log.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
