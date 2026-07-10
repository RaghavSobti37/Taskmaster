const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const DailyMission = require('../models/DailyMission');
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { getCurrentWeekRange, getCurrentMonthRange, getPreviousMonthRange } = require('../utils/attendanceDate');
const { ACTION_LABELS } = require('../../shared/gamificationRules');

const toSimpleMessage = (log) => {
  if (log.action === 'XP_RECALC_ADJUSTMENT') {
    return log.details?.message
      || `XP recalculated (${log.details?.reason || 'adjustment'})`;
  }
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
    const { weekStartKey } = getCurrentWeekRange();

    await GamificationService.generateDailyMissions(req.user._id);
    await GamificationService.generateWeeklyMissions(req.user._id);

    const missions = await DailyMission.find({
      userId: req.user._id,
      $or: [
        { cadence: { $ne: 'weekly' }, date: { $gte: today } },
        { cadence: 'weekly', weekKey: weekStartKey },
      ],
    }).sort({ cadence: 1, date: 1 });

    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/progress', protect, async (req, res) => {
  try {
    const user = req.user;
    const plain = await GamificationService.getConfigPlain();

    const XPAuditLog = require('../models/XPAuditLog');
    const adjustedLogCount = await XPAuditLog.countDocuments({
      userId: user._id,
      $or: [
        { recalculatedAt: { $exists: true, $ne: null } },
        { action: 'XP_RECALC_ADJUSTMENT' },
      ],
    });

    res.json({
      exp: user.exp || 0,
      lastRecalculatedAt: plain.lastRecalculatedAt || null,
      hasAdjustedHistory: adjustedLogCount > 0,
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

    const GamificationConfig = require('../models/GamificationConfig');
    const configDoc = await GamificationConfig.findOne().select('lastRecalculatedAt').lean();

    res.json({
      logs: logs.map((log) => GamificationService.formatXpLogForApi(log, config, toSimpleMessage)),
      total,
      page,
      limit,
      lastRecalculatedAt: configDoc?.lastRecalculatedAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard', protect, async (req, res) => {
  try {
    const XPAuditLog = require('../models/XPAuditLog');
    const GamificationConfig = require('../models/GamificationConfig');
    const monthStartInput = req.query.monthStartKey || undefined;
    const monthlySnapshot = await GamificationService.getMonthlyLeaderboardSnapshot(monthStartInput);
    await GamificationService.backfillPreviousMonthSnapshot();
    const config = await GamificationService.getConfigPlain();
    const configDoc = await GamificationConfig.findOne()
      .select('lastRecalculatedAt lastRecalcWeeklyPrior')
      .lean();
    const lastRecalculatedAt = configDoc?.lastRecalculatedAt || null;
    const monthlyPriorSnapshot = configDoc?.lastRecalcWeeklyPrior || null;
    const currentEntries = monthlySnapshot.entries || [];
    const tenantUserIds = currentEntries.map((entry) => entry.userId);

    const { monthStart, monthEnd } = getCurrentMonthRange(monthlySnapshot.monthStartKey);
    const monthLogs = await XPAuditLog.find({
      userId: { $in: tenantUserIds },
      createdAt: { $gte: monthStart, $lte: monthEnd },
    })
      .select('userId action amount details previousAmount recalculatedAt recalcReason')
      .lean();
    const backfillMaps = await GamificationService.fetchHoursBackfillMaps(monthLogs);
    const recalcMetaByUser = GamificationService.buildWeeklyRecalcMetaByUser(
      monthLogs,
      config,
      backfillMaps,
      lastRecalculatedAt
    );

    const prevMonth = getPreviousMonthRange();
    const lastMonthMonthly = await GamificationService.getMonthlyLeaderboardSnapshot(prevMonth.monthStartKey);
    const lastMonthRankByUserId = new Map(
      (lastMonthMonthly.entries || []).map((row) => [String(row.userId), Number(row.rank) || 0])
    );

    const top = currentEntries.map((user) => {
        const userKey = String(user.userId);
        const meta = recalcMetaByUser.get(userKey);
        const snapshotPrior = monthlyPriorSnapshot?.[userKey];
        const useSnapshot = lastRecalculatedAt && monthlyPriorSnapshot && snapshotPrior !== undefined;
        const monthlyXpPrior = useSnapshot
          ? snapshotPrior
          : (meta?.weeklyXpPrior ?? undefined);
        const monthlyXpDelta = useSnapshot
          ? user.monthlyXp - snapshotPrior
          : (meta?.weeklyXpDelta ?? 0);
        const hasRecalcDelta = Boolean(
          lastRecalculatedAt
          && (useSnapshot
            ? monthlyXpDelta !== 0
            : meta && (monthlyXpDelta !== 0 || (meta.changes?.length ?? 0) > 0))
        );
        return {
          rank: user.rank,
          monthlyXp: Number(user.monthlyXp) || 0,
          _id: user.userId,
          name: user.name,
          avatar: user.avatar,
          lastMonthRank: lastMonthRankByUserId.get(userKey),
          monthlyXpPrior: hasRecalcDelta ? monthlyXpPrior : undefined,
          monthlyXpDelta: hasRecalcDelta ? monthlyXpDelta : undefined,
          recalcChanges: hasRecalcDelta
            ? (meta?.changes?.slice(0, 8) || [])
            : undefined,
        };
      });

    logger.debug('Gamification', 'Leaderboard fetch', {
      monthStart: monthlySnapshot.monthStartKey,
      monthEnd: monthlySnapshot.monthEndKey,
      logCount: monthlySnapshot.logCount,
      storedSum: monthlySnapshot.storedSum,
      resolvedSum: monthlySnapshot.resolvedSum,
      configTaskCompletion: config.taskCompletion,
      top3: top.slice(0, 3).map((entry) => ({
        userId: entry._id,
        name: entry.name,
        monthlyXp: entry.monthlyXp,
      })),
      cacheHit: false,
    });

    res.set('Cache-Control', 'private, max-age=60');
    res.json({
      entries: top,
      meta: {
        monthStartKey: monthlySnapshot.monthStartKey,
        monthEndKey: monthlySnapshot.monthEndKey,
        lastRecalculatedAt,
        logCount: monthlySnapshot.logCount,
        configRates: config,
        lastMonthStartKey: prevMonth.monthStartKey,
        lastMonthEndKey: prevMonth.monthEndKey,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard/history', protect, async (req, res) => {
  try {
    const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 12));
    const history = await GamificationService.listMonthlyLeaderboardHistory(limit);
    res.json({ history });
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
    const monthStartInput = req.query.monthStartKey || undefined;
    const { monthStart, monthEnd, monthStartKey, monthEndKey } = getCurrentMonthRange(monthStartInput);

    const logs = await XPAuditLog.find({
      userId,
      createdAt: { $gte: monthStart, $lte: monthEnd },
    })
      .sort({ createdAt: -1 })
      .lean();

    const backfillMaps = await GamificationService.fetchHoursBackfillMaps(logs);
    const user = await User.findById(userId, 'name avatar').lean();
    const dedupedLogs = GamificationService.dedupeXpAuditLogsForTotals(logs);

    const groupedBreakdown = GamificationService.buildWeeklyGroupedBreakdown(
      logs,
      config,
      backfillMaps
    );

    const totalXp = dedupedLogs.reduce(
      (sum, item) => sum + GamificationService.resolveLogAmount(config, item, backfillMaps),
      0
    );
    const calculationSummary = GamificationService.buildCalculationSummary(groupedBreakdown, totalXp);

    res.json({
      user: user || { _id: userId, name: 'Unknown' },
      monthStart,
      monthEnd,
      monthStartKey,
      monthEndKey,
      totalXp,
      groupedBreakdown,
      calculationSummary,
      recentLogs: dedupedLogs.slice(0, 15).map((log) =>
        GamificationService.formatXpLogForApi(log, config, toSimpleMessage)
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
