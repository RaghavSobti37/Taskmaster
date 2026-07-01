const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const DailyMission = require('../models/DailyMission');
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { getCurrentWeekRange, getPreviousWeekRange, todayStart, todayEnd } = require('../utils/attendanceDate');
const { ACTION_LABELS } = require('../../shared/gamificationRules');
const { getCache, setCache } = require('../services/cacheService');

const LEADERBOARD_CACHE_TTL_SECONDS = 60;

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
    const dayStart = todayStart();
    const dayEnd = todayEnd();
    const { weekStartKey } = getCurrentWeekRange();

    await GamificationService.generateDailyMissions(req.user._id);
    await GamificationService.generateWeeklyMissions(req.user._id);

    const missions = await DailyMission.find({
      userId: req.user._id,
      $or: [
        { cadence: { $ne: 'weekly' }, date: { $gte: dayStart, $lte: dayEnd } },
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
    const config = await GamificationService.getConfig();
    const plain = config?.toObject ? config.toObject() : config;
    const stepXp = plain.stepXp || 100;
    const currentLevelExp = await GamificationService.getExpForLevel(user.level || 1);
    const nextLevelExp = await GamificationService.getExpForLevel((user.level || 1) + 1);

    const XPAuditLog = require('../models/XPAuditLog');
    const adjustedLogCount = await XPAuditLog.countDocuments({
      userId: user._id,
      $or: [
        { recalculatedAt: { $exists: true, $ne: null } },
        { action: 'XP_RECALC_ADJUSTMENT' },
      ],
    });

    res.json({
      level: user.level || 1,
      exp: user.exp || 0,
      stepXp,
      currentLevelExp,
      nextLevelExp,
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
    const User = require('../models/User');
    const XPAuditLog = require('../models/XPAuditLog');
    const GamificationConfig = require('../models/GamificationConfig');
    const weekly = await GamificationService.getWeeklyLeaderboard();
    const cacheKey = `leaderboard:v2:${weekly.weekStartKey}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'private, max-age=60');
      return res.json(cached);
    }

    const [config, configDoc, allUsers] = await Promise.all([
      GamificationService.getConfigPlain(),
      GamificationConfig.findOne()
        .select('lastRecalculatedAt lastRecalcWeeklyPrior')
        .lean(),
      User.find({}, 'name avatar exp level').sort({ name: 1 }).lean(),
    ]);
    const lastRecalculatedAt = configDoc?.lastRecalculatedAt || null;
    const weeklyPriorSnapshot = configDoc?.lastRecalcWeeklyPrior || null;

    const tenantUserIds = allUsers.map((u) => u._id);

    const prevWeek = getPreviousWeekRange();
    const [weekLogs, lastWeekWeekly] = await Promise.all([
      XPAuditLog.find({
        userId: { $in: tenantUserIds },
        createdAt: { $gte: weekly.weekStart, $lte: weekly.weekEnd },
      })
        .select('userId action amount details previousAmount recalculatedAt recalcReason')
        .lean(),
      GamificationService.getWeeklyLeaderboard(null, prevWeek.weekStartKey),
    ]);
    const backfillMaps = await GamificationService.fetchHoursBackfillMaps(weekLogs);
    const recalcMetaByUser = GamificationService.buildWeeklyRecalcMetaByUser(
      weekLogs,
      config,
      backfillMaps,
      lastRecalculatedAt
    );

    const weeklyXpByUserId = new Map(
      weekly.entries.map(([userId, weeklyXp]) => [String(userId), weeklyXp])
    );

    const lastWeekXpByUserId = new Map(
      lastWeekWeekly.entries.map(([userId, weeklyXp]) => [String(userId), weeklyXp])
    );
    const lastWeekRankByUserId = new Map(
      [...allUsers]
        .map((user) => ({
          _id: user._id,
          name: user.name,
          weeklyXp: lastWeekXpByUserId.get(String(user._id)) || 0,
        }))
        .sort((a, b) => {
          if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
          return (a.name || '').localeCompare(b.name || '');
        })
        .map((user, index) => [String(user._id), index + 1])
    );

    const top = allUsers
      .map((user) => ({
        ...user,
        weeklyXp: weeklyXpByUserId.get(String(user._id)) || 0,
      }))
      .sort((a, b) => {
        if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
        return (a.name || '').localeCompare(b.name || '');
      })
      .map((user, index) => {
        const userKey = String(user._id);
        const meta = recalcMetaByUser.get(userKey);
        const snapshotPrior = weeklyPriorSnapshot?.[userKey];
        const useSnapshot = lastRecalculatedAt && weeklyPriorSnapshot && snapshotPrior !== undefined;
        const weeklyXpPrior = useSnapshot
          ? snapshotPrior
          : (meta?.weeklyXpPrior ?? undefined);
        const weeklyXpDelta = useSnapshot
          ? user.weeklyXp - snapshotPrior
          : (meta?.weeklyXpDelta ?? 0);
        const hasRecalcDelta = Boolean(
          lastRecalculatedAt
          && (useSnapshot
            ? weeklyXpDelta !== 0
            : meta && (weeklyXpDelta !== 0 || (meta.changes?.length ?? 0) > 0))
        );
        return {
          rank: index + 1,
          weeklyXp: user.weeklyXp,
          _id: user._id,
          name: user.name,
          avatar: user.avatar,
          exp: user.exp,
          level: user.level,
          lastWeekRank: lastWeekRankByUserId.get(userKey),
          weeklyXpPrior: hasRecalcDelta ? weeklyXpPrior : undefined,
          weeklyXpDelta: hasRecalcDelta ? weeklyXpDelta : undefined,
          recalcChanges: hasRecalcDelta
            ? (meta?.changes?.slice(0, 8) || [])
            : undefined,
        };
      });

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

    const payload = {
      entries: top,
      meta: {
        weekStartKey: weekly.weekStartKey,
        weekEndKey: weekly.weekEndKey,
        lastRecalculatedAt,
        logCount: weekly.logCount,
        configRates: weekly.configRates,
        lastWeekStartKey: prevWeek.weekStartKey,
        lastWeekEndKey: prevWeek.weekEndKey,
      },
    };

    await setCache(cacheKey, payload, LEADERBOARD_CACHE_TTL_SECONDS);
    res.set('Cache-Control', 'private, max-age=60');
    res.json(payload);
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

    const backfillMaps = await GamificationService.fetchHoursBackfillMaps(logs);
    const user = await User.findById(userId, 'name avatar level xp').lean();
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

    res.json({
      user: user || { _id: userId, name: 'Unknown' },
      weekStart,
      weekEnd,
      weekStartKey,
      weekEndKey,
      totalXp,
      groupedBreakdown,
      recentLogs: dedupedLogs.slice(0, 15).map((log) =>
        GamificationService.formatXpLogForApi(log, config, toSimpleMessage)
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
