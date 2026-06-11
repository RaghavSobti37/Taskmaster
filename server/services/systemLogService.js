const crypto = require('crypto');
const mongoose = require('mongoose');
const SystemLog = require('../models/SystemLog');
const { isLogsPrimarySupabase, MONGO_LOG_ARCHIVE } = require('../config/supabase');
const { insertSystemLog } = require('./supabase/logStore');

const PERSIST_SYSTEM_LOGS = String(process.env.PERSIST_SYSTEM_LOGS || 'false').toLowerCase() === 'true';
const User = require('../models/User');
const {
  SEVERITY,
  inferModuleFromRoute,
  isValidSeverity,
  isValidModule,
} = require('../../shared/systemLogContract');
const { getTenantId, getUserId, getTraceId } = require('../utils/tenantContext');

const SENSITIVE_KEY = /password|token|secret|authorization|api[_-]?key|credential/i;
const SYSTEM_ACTORS = new Set(['SYSTEM', 'ANON']);

function isUserActorId(actorId) {
  return actorId && !SYSTEM_ACTORS.has(actorId) && mongoose.Types.ObjectId.isValid(actorId);
}

async function resolveActorNames(actorIds = []) {
  const ids = [...new Set(actorIds.filter(isUserActorId))];
  if (!ids.length) return {};

  const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
  return Object.fromEntries(
    users.map((user) => [user._id.toString(), user.name || user.email])
  );
}

async function enrichLogsWithActorNames(logs = []) {
  if (!logs.length) return logs;

  const nameById = await resolveActorNames(logs.map((log) => log.actorId));
  return logs.map((log) => {
    if (log.actorName || !isUserActorId(log.actorId)) return log;
    const actorName = nameById[log.actorId];
    return actorName ? { ...log, actorName } : log;
  });
}

async function enrichLogWithActorName(log = {}) {
  if (log.actorName || !isUserActorId(log.actorId)) return log;
  const nameById = await resolveActorNames([log.actorId]);
  const actorName = nameById[log.actorId];
  return actorName ? { ...log, actorName } : log;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 6) return '[MaxDepth]';
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitizeValue(val, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function normalizeEntry(raw = {}) {
  const traceId = raw.traceId || getTraceId() || require('crypto').randomUUID();
  const severity = isValidSeverity(raw.severity) ? raw.severity : SEVERITY.INFO;
  const module = isValidModule(raw.module) ? raw.module : inferModuleFromRoute(raw.route);

  return {
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
    traceId,
    contextId: raw.contextId || undefined,
    severity,
    module,
    message: String(raw.message || 'System event').slice(0, 2000),
    userVisible: Boolean(raw.userVisible),
    actorId: raw.actorId || getUserId()?.toString() || 'SYSTEM',
    actorName: raw.actorName || undefined,
    route: raw.route,
    method: raw.method,
    httpStatus: raw.httpStatus,
    errorCode: raw.errorCode,
    payload: raw.payload != null ? sanitizeValue(raw.payload) : undefined,
    relatedEntities: Array.isArray(raw.relatedEntities) ? raw.relatedEntities : undefined,
    tenantId: raw.tenantId || getTenantId() || undefined,
  };
}

function broadcastSystemLog(doc) {
  if (!PERSIST_SYSTEM_LOGS) return;
  const { broadcastRealtimeEvent } = require('../config/realtime');
  broadcastRealtimeEvent('system-logs', 'system_log', doc);
}

function formatStdoutLog(entry) {
  const meta = {
    traceId: entry.traceId,
    module: entry.module,
    route: entry.route,
    httpStatus: entry.httpStatus,
    errorCode: entry.errorCode,
  };
  return `[SystemLog] ${entry.severity} ${entry.message} ${JSON.stringify(meta)}`;
}

async function archiveSystemLogToMongo(entry) {
  if (!MONGO_LOG_ARCHIVE) return;
  try {
    await SystemLog.create(entry);
  } catch (err) {
    console.error('[SystemLog] Mongo archive failed', {
      error: err.message,
      traceId: entry.traceId,
    });
  }
}

async function persistSystemLog(entry) {
  const plain = {
    ...entry,
    _id: entry._id || crypto.randomUUID(),
    timestamp: entry.timestamp,
    createdAt: entry.timestamp,
  };

  await insertSystemLog(plain);
  const enriched = await enrichLogWithActorName(plain);
  broadcastSystemLog(enriched);
  setImmediate(() => archiveSystemLogToMongo(entry));
}

function writeSystemLog(rawEntry) {
  const entry = normalizeEntry(rawEntry);

  if (!PERSIST_SYSTEM_LOGS) {
    const level = entry.severity === 'ERROR'
      ? 'error'
      : entry.severity === 'WARN'
        ? 'warn'
        : 'log';
    console[level](formatStdoutLog(entry));
    return entry;
  }

  if (isLogsPrimarySupabase()) {
    setImmediate(() => {
      persistSystemLog(entry).catch((err) => {
        console.error('[SystemLog] Supabase persist failed', {
          error: err.message,
          traceId: entry.traceId,
        });
      });
    });
    return entry;
  }

  setImmediate(async () => {
    try {
      const doc = await SystemLog.create(entry);
      const plain = await enrichLogWithActorName(doc.toObject());
      broadcastSystemLog(plain);
    } catch (err) {
      console.error('[SystemLog] Failed to persist system log', {
        error: err.message,
        traceId: entry.traceId,
      });
    }
  });

  return entry;
}

function logFromError(req, err, options = {}) {
  const statusCode = options.statusCode
    ?? (req.res?.statusCode && req.res.statusCode !== 200 ? req.res.statusCode : 500);
  const severity = options.severity
    ?? (statusCode >= 500 ? SEVERITY.ERROR : SEVERITY.WARN);

  let message = err?.message || 'Unknown error';
  let errors = null;

  if (err?.name === 'ValidationError' && err.errors) {
    message = 'Validation failed';
    errors = Object.values(err.errors).reduce((acc, cur) => {
      acc[cur.path] = cur.message;
      return acc;
    }, {});
  }

  return writeSystemLog({
    traceId: req.traceId || getTraceId(),
    severity,
    module: inferModuleFromRoute(req.originalUrl),
    message,
    userVisible: options.userVisible ?? true,
    actorId: req.user?._id?.toString() || 'ANON',
    actorName: req.user?.name || req.user?.email || undefined,
    route: req.originalUrl,
    method: req.method,
    httpStatus: statusCode,
    errorCode: err?.name || options.errorCode || 'ServerError',
    payload: {
      errors,
      stack: err?.stack,
    },
  });
}

module.exports = {
  writeSystemLog,
  logFromError,
  inferModuleFromRoute,
  broadcastSystemLog,
  sanitizeValue,
  enrichLogsWithActorNames,
  enrichLogWithActorName,
  PERSIST_SYSTEM_LOGS,
};
