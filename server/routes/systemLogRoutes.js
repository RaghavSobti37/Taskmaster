const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, opsOrAdmin } = require('../middleware/authMiddleware');
const { getTenantId } = require('../utils/tenantContext');
const SystemLog = require('../models/SystemLog');
const { writeSystemLog, enrichLogsWithActorNames, PERSIST_SYSTEM_LOGS } = require('../services/systemLogService');
const {
  SEVERITY,
  isValidSeverity,
  isValidModule,
} = require('../../shared/systemLogContract');

const router = express.Router();

const clientLogLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many log submissions, please slow down.' },
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

function shouldPersistClientLog({ severity, userVisible, errorCode }) {
  if (errorCode === 'PAGE_VIEW') return true;
  if (severity === SEVERITY.ERROR || severity === SEVERITY.WARN) return true;
  if (userVisible && (severity === SEVERITY.SUCCESS || severity === SEVERITY.INFO)) return true;
  return false;
}

router.post('/', protect, clientLogLimiter, (req, res) => {
  const {
    severity,
    module,
    message,
    userVisible,
    payload,
    relatedEntities,
    traceId,
    contextId,
    route,
    errorCode,
  } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!isValidSeverity(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }
  if (module && !isValidModule(module)) {
    return res.status(400).json({ error: 'Invalid module' });
  }

  const visible = Boolean(userVisible);
  if (!PERSIST_SYSTEM_LOGS) {
    writeSystemLog({
      traceId: traceId || req.traceId,
      contextId,
      severity,
      module: module || undefined,
      message,
      userVisible: visible,
      route: route || req.headers['x-client-route'],
      method: 'CLIENT',
      errorCode,
      payload,
      relatedEntities,
      actorId: req.user._id.toString(),
      actorName: req.user.name || req.user.email,
      tenantId: req.tenantId,
    });
    return res.json({ success: true, persisted: false, traceId: req.traceId, consoleOnly: true });
  }

  if (!shouldPersistClientLog({ severity, userVisible: visible, errorCode })) {
    return res.json({ success: true, persisted: false, traceId: req.traceId });
  }

  const entry = writeSystemLog({
    traceId: traceId || req.traceId,
    contextId,
    severity,
    module: module || undefined,
    message,
    userVisible: visible,
    route: route || req.headers['x-client-route'],
    method: 'CLIENT',
    errorCode,
    payload,
    relatedEntities,
    actorId: req.user._id.toString(),
    actorName: req.user.name || req.user.email,
    tenantId: req.tenantId,
  });

  res.status(201).json({ success: true, persisted: true, traceId: entry.traceId });
});

router.get('/analytics/top-pages', protect, opsOrAdmin, async (req, res) => {
  if (!PERSIST_SYSTEM_LOGS) {
    return res.json({ days: parseInt(req.query.days, 10) || 7, pages: [], persistenceDisabled: true });
  }
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const tenantId = getTenantId();
    const match = {
      errorCode: 'PAGE_VIEW',
      timestamp: { $gte: since },
    };
    if (tenantId) match.tenantId = tenantId;

    const pages = await SystemLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$route',
          count: { $sum: 1 },
          users: { $addToSet: '$actorId' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          path: '$_id',
          count: 1,
          uniqueUsers: { $size: '$users' },
        },
      },
    ]);

    res.json({ days, pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', protect, opsOrAdmin, async (req, res) => {
  if (!PERSIST_SYSTEM_LOGS) {
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    return res.json({
      logs: [],
      persistenceDisabled: true,
      pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
    });
  }
  try {
    const {
      module,
      severity,
      traceId,
      search,
      from,
      to,
      page = 1,
      limit = 50,
      excludePageViews,
    } = req.query;

    const filter = {};
    if (module) filter.module = module;
    if (severity) filter.severity = severity;
    if (traceId) filter.traceId = traceId;
    if (search) filter.message = { $regex: search, $options: 'i' };
    if (excludePageViews === 'true') {
      filter.errorCode = { $ne: 'PAGE_VIEW' };
    }
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      SystemLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SystemLog.countDocuments(filter),
    ]);

    // Ops users can view system logs, but strip admin-scoped entries
    const { isAdminUser } = require('../utils/departmentPermissions');
    const isAdmin = isAdminUser(req.user);
    const ADMIN_ONLY_MODULES = new Set(['ADMIN', 'SCRIPTS', 'GAMIFICATION', 'USERS']);
    const filtered = isAdmin
      ? logs
      : logs.filter(l => !ADMIN_ONLY_MODULES.has(l.module));

    res.json({
      logs: await enrichLogsWithActorNames(filtered),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:traceId/trail', protect, opsOrAdmin, async (req, res) => {
  if (!PERSIST_SYSTEM_LOGS) {
    return res.json({ traceId: req.params.traceId, logs: [], persistenceDisabled: true });
  }
  try {
    const { traceId } = req.params;
    const logs = await SystemLog.find({ traceId })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ traceId, logs: await enrichLogsWithActorNames(logs) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
