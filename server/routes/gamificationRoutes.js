const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const DailyMission = require('../models/DailyMission');
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { getCurrentWeekRange } = require('../utils/attendanceDate');
const { ACTION_LABELS } = require('../../shared/gamificationRules');

const toSimpleMessage = (log) => {
  const base = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase();
  if (log.action === 'MISSION_COMPLETE' && log.details?.title) {
    return `${base}: ${log.details.title}`;
  }
  if (log.action === 'ATTENDANCE_ACTION' && log.details?.date) {
    const hours = log.details?.hours != null ? ` · ${Number(log.details.hours).toFixed(1)}h` : '';
    return `${base} (${log.details.date}${hours})`;
  }
  if (log.details?.hours != null && ['COMPLETE_TASK', 'DAILY_LOG'].includes(log.action)) {
    return `${base} · ${Number(log.details.hours).toFixed(2)}h`;
  }
  return base;
};

router.get('/missions', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await GamificationService.generateDailyMissions(req.user._id);

    const missions = await DailyMission.find({
      userId: req.user._id,
      date: { $gte: today },
    });

    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/progress', protect, async (req, res) => {
  try {
    const user = req.user;
    const config = await GamificationService.getConfigPlain();
    const stepXp = config.stepXp || 100;
    const currentLevelExp = await GamificationService.getExpForLevel(user.level || 1);
    const nextLevelExp = await GamificationService.getExpForLevel((user.level || 1) + 1);

    res.json({
      level: user.level || 1,
      exp: user.exp || 0,
      stepXp,
      currentLevelExp,
      nextLevelExp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const XPAuditLog = require('../models/XPAuditLog');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const config = await GamificationService.getConfigPlain();
    const userId = req.user._id;

    const [logs, total] = await Promise.all([
      XPAuditLog.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      XPAuditLog.countDocuments({ userId }),
    ]);

    res.json({
      logs: logs.map((log) => ({
        _id: log._id,
        amount: GamificationService.resolveLogAmount(config, log),
        action: log.action,
        actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
        message: toSimpleMessage(log),
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const weekly = await GamificationService.getWeeklyLeaderboard();

    const weeklyXpByUserId = new Map(
      weekly.entries.map(([userId, weeklyXp]) => [String(userId), weeklyXp])
    );

    const allUsers = await User.find({}, 'name avatar exp level').sort({ name: 1 }).lean();

    const top = allUsers
      .map((user) => ({
        ...user,
        weeklyXp: weeklyXpByUserId.get(String(user._id)) || 0,
      }))
      .sort((a, b) => {
        if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
        return (a.name || '').localeCompare(b.name || '');
      })
      .map((user, index) => ({
        rank: index + 1,
        weeklyXp: user.weeklyXp,
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
        exp: user.exp,
        level: user.level,
      }));

    logger.debug('Gamification', 'Leaderboard fetch', {
      weekStart: weekly.weekStartKey,
      weekEnd: weekly.weekEndKey,
      logCount: weekly.logCount,
      storedSum: weekly.storedSum,
      resolvedSum: weekly.resolvedSum,
      configTaskCompletion: weekly.configRates?.taskCompletion,
      top3: top.slice(0, 3).map((entry) => ({
        userId: entry._id,
        name: entry.name,
        weeklyXp: entry.weeklyXp,
      })),
      cacheHit: false,
    });

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard/:userId/breakdown', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const XPAuditLog = require('../models/XPAuditLog');
    const User = require('../models/User');
    const config = await GamificationService.getConfigPlain();
    const { weekStart, weekEnd, weekStartKey, weekEndKey } = getCurrentWeekRange();

    const logs = await XPAuditLog.find({
      userId,
      createdAt: { $gte: weekStart, $lte: weekEnd },
    })
      .sort({ createdAt: -1 })
      .lean();

    const user = await User.findById(userId, 'name avatar level xp').lean();

    const groupedMap = new Map();
    for (const log of logs) {
      const resolvedAmount = GamificationService.resolveLogAmount(config, log);
      const key = `${log.action}::${resolvedAmount}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          action: log.action,
          actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
          amountPerAction: resolvedAmount,
          count: 0,
          totalXp: 0,
          sampleMessage: toSimpleMessage(log),
        });
      }
      const group = groupedMap.get(key);
      group.count += 1;
      group.totalXp += resolvedAmount;
    }

    const groupedBreakdown = Array.from(groupedMap.values()).sort((a, b) => b.totalXp - a.totalXp);
    const totalXp = logs.reduce(
      (sum, item) => sum + GamificationService.resolveLogAmount(config, item),
      0
    );

    res.json({
      user: user || { _id: userId, name: 'Unknown' },
      weekStart,
      weekEnd,
      weekStartKey,
      weekEndKey,
      totalXp,
      groupedBreakdown,
      recentLogs: logs.slice(0, 15).map((log) => ({
        _id: log._id,
        amount: GamificationService.resolveLogAmount(config, log),
        action: log.action,
        actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
        message: toSimpleMessage(log),
        createdAt: log.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
