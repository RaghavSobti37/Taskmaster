const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { getSharedRedis } = require('./sharedRedis');
const { sessionMetaFromRequest, pickSessionIp, formatSessionIp } = require('./sessionRequestMeta');
const { absoluteMaxMs, establishSession } = require('./authSession');

const SESSION_PREFIX = 'sessions:user:';
const memorySessions = new Map();
const lastTouchWrites = new Map();
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const isRedisReady = () => {
  const redis = getSharedRedis();
  return redis?.status === 'ready';
};

const userKey = (userId) => `${SESSION_PREFIX}${userId}`;

const pruneExpired = (sessions) => {
  const now = Date.now();
  return sessions.filter((s) => !s.expiresAt || s.expiresAt > now);
};

const readMemory = (userId) => {
  const list = memorySessions.get(String(userId)) || [];
  const fresh = pruneExpired(list);
  memorySessions.set(String(userId), fresh);
  return fresh;
};

const writeMemory = (userId, sessions) => {
  memorySessions.set(String(userId), pruneExpired(sessions));
};

const redisGetAll = async (userId) => {
  if (!isRedisReady()) return null;
  const redis = getSharedRedis();
  try {
    const raw = await redis.hgetall(userKey(userId));
    if (!raw || !Object.keys(raw).length) return [];
    return pruneExpired(Object.values(raw).map((v) => JSON.parse(v)));
  } catch (err) {
    logger.warn('sessionRegistry', 'Redis read failed; using memory', { error: err.message });
    return null;
  }
};

const redisSave = async (userId, session) => {
  if (!isRedisReady()) return false;
  const redis = getSharedRedis();
  try {
    const key = userKey(userId);
    await redis.hset(key, session.jti, JSON.stringify(session));
    await redis.pexpire(key, absoluteMaxMs());
    return true;
  } catch (err) {
    logger.warn('sessionRegistry', 'Redis write failed; using memory', { error: err.message });
    return false;
  }
};

const redisDelete = async (userId, jti) => {
  if (!isRedisReady()) return false;
  const redis = getSharedRedis();
  try {
    await redis.hdel(userKey(userId), jti);
    return true;
  } catch {
    return false;
  }
};

const buildSessionRecord = (decoded, meta) => {
  const now = new Date().toISOString();
  const expMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + absoluteMaxMs();
  return {
    jti: decoded.jti,
    userAgent: meta.userAgent,
    ip: meta.ip,
    label: meta.label,
    createdAt: now,
    lastSeenAt: now,
    loginAt: decoded.loginAt ?? decoded.iat ?? null,
    expiresAt: expMs,
  };
};

const listUserSessions = async (userId, currentJti = null) => {
  const fromRedis = await redisGetAll(userId);
  const sessions = fromRedis ?? readMemory(userId);
  return sessions
    .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
    .map((s) => ({
      jti: s.jti,
      label: s.label,
      ip: formatSessionIp(s.ip),
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: currentJti ? s.jti === currentJti : false,
    }));
};

const upsertSession = async (userId, decoded, meta) => {
  if (!decoded?.jti || !userId) return;
  const record = buildSessionRecord(decoded, meta);
  const saved = await redisSave(userId, record);
  if (!saved) {
    const list = readMemory(userId).filter((s) => s.jti !== record.jti);
    list.push(record);
    writeMemory(userId, list);
  }
};

const registerSession = async (req, userId, decoded) => {
  await upsertSession(userId, decoded, sessionMetaFromRequest(req));
};

const sessionExists = async (userId, jti) => {
  if (!userId || !jti) return false;
  const fromRedis = await redisGetAll(userId);
  const list = fromRedis ?? readMemory(userId);
  return list.some((s) => s.jti === jti);
};

/** Register pre-B3 / missing registry rows for valid JWTs. */
const ensureSession = async (req, userId, decoded) => {
  if (!userId || !decoded?.jti) return false;
  if (await sessionExists(userId, decoded.jti)) return false;
  await registerSession(req, userId, decoded);
  return true;
};

const touchSession = async (userId, jti, req = null) => {
  if (!userId || !jti) return;
  const touchKey = `${userId}:${jti}`;
  const now = Date.now();
  const last = lastTouchWrites.get(touchKey) || 0;
  if (now - last < TOUCH_INTERVAL_MS) return;
  lastTouchWrites.set(touchKey, now);

  const fromRedis = await redisGetAll(userId);
  const list = fromRedis ?? readMemory(userId);
  const idx = list.findIndex((s) => s.jti === jti);
  if (idx < 0) return;
  list[idx].lastSeenAt = new Date().toISOString();
  if (req) {
    const meta = sessionMetaFromRequest(req);
    list[idx].ip = pickSessionIp(list[idx].ip, meta.ip);
    if (meta.label) list[idx].label = meta.label;
  }
  const saved = await redisSave(userId, list[idx]);
  if (!saved) writeMemory(userId, list);
};

const rotateSession = async (req, userId, oldJti, newDecoded) => {
  if (!userId || !newDecoded?.jti) return;
  const fromRedis = await redisGetAll(userId);
  const list = fromRedis ?? readMemory(userId);
  const prior = list.find((s) => s.jti === oldJti);
  const meta = sessionMetaFromRequest(req);
  const record = buildSessionRecord(newDecoded, {
    ...meta,
    label: prior?.label || meta.label,
  });
  if (prior) record.createdAt = prior.createdAt;

  await redisDelete(userId, oldJti);
  const saved = await redisSave(userId, record);
  if (!saved) {
    const next = list.filter((s) => s.jti !== oldJti && s.jti !== record.jti);
    next.push(record);
    writeMemory(userId, next);
  }
};

const removeSession = async (userId, jti) => {
  if (!userId || !jti) return;
  await redisDelete(userId, jti);
  const list = readMemory(userId).filter((s) => s.jti !== jti);
  writeMemory(userId, list);
};

const decodeToken = (token) => {
  if (!token) return null;
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

const finishAuthSession = async (req, res, userId) => {
  const token = establishSession(res, userId);
  const decoded = decodeToken(token);
  if (decoded) await registerSession(req, userId, decoded);
  return token;
};

module.exports = {
  listUserSessions,
  registerSession,
  ensureSession,
  touchSession,
  rotateSession,
  removeSession,
  finishAuthSession,
  decodeToken,
  _resetForTests: () => {
    memorySessions.clear();
    lastTouchWrites.clear();
  },
};
