const mongoose = require('mongoose');
const { config } = require('../config');
const { isRedisAvailable } = require('./backgroundQueue');
const { pingSharedRedis } = require('../utils/sharedRedis');
const { pingSupabase, closeSupabaseClients } = require('./supabase/client');
const { isSupabaseConfigured, isSupabaseEnabled } = require('../config/supabase');
const { getQueueAdminSnapshot } = require('./queueAdminService');

const MONGO_LABELS = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function serviceResult({ id, label, status, state, latencyMs = null, error = null, detail = null }) {
  return {
    id,
    label,
    status,
    state,
    latencyMs,
    error: error || null,
    detail: detail || null,
  };
}

async function withLatency(fn) {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, latencyMs: Date.now() - start, error: null };
  } catch (err) {
    return { value: null, latencyMs: Date.now() - start, error: err.message };
  }
}

async function probeMongo() {
  const readyState = mongoose.connection.readyState;
  const state = MONGO_LABELS[readyState] || String(readyState);

  if (readyState !== 1) {
    return serviceResult({
      id: 'mongodb',
      label: 'MongoDB',
      status: 'down',
      state,
      error: `Database ${state}`,
    });
  }

  const { latencyMs, error } = await withLatency(() => mongoose.connection.db.admin().ping());
  if (error) {
    return serviceResult({
      id: 'mongodb',
      label: 'MongoDB',
      status: 'down',
      state,
      latencyMs,
      error,
    });
  }

  return serviceResult({
    id: 'mongodb',
    label: 'MongoDB',
    status: 'ok',
    state,
    latencyMs,
  });
}

async function probeRedis() {
  const configured = Boolean(config.redis?.url);
  const available = isRedisAvailable();

  if (!configured) {
    return serviceResult({
      id: 'redis',
      label: 'Redis / BullMQ',
      status: config.isProduction ? 'down' : 'degraded',
      state: 'not_configured',
      error: 'REDIS_URL not set',
    });
  }

  const { latencyMs, error } = await withLatency(async () => {
    const pong = await pingSharedRedis();
    if (pong !== 'PONG') throw new Error(`Unexpected PING response: ${pong}`);
  });

  if (error || !available) {
    const isProd = config.isProduction;
    return serviceResult({
      id: 'redis',
      label: 'Redis / BullMQ',
      status: isProd ? 'down' : 'degraded',
      state: available ? 'error' : 'unavailable',
      latencyMs,
      error: error || 'Redis not connected — using memory fallback',
    });
  }

  return serviceResult({
    id: 'redis',
    label: 'Redis / BullMQ',
    status: 'ok',
    state: 'connected',
    latencyMs,
  });
}

async function probeSupabase() {
  if (!isSupabaseConfigured()) {
    return serviceResult({
      id: 'supabase',
      label: 'Supabase',
      status: 'ok',
      state: 'not_configured',
      detail: 'Secondary store not configured',
    });
  }

  if (!isSupabaseEnabled()) {
    return serviceResult({
      id: 'supabase',
      label: 'Supabase',
      status: 'degraded',
      state: 'disabled',
      detail: 'Configured but disabled',
    });
  }

  const { latencyMs, value: ping, error } = await withLatency(() => pingSupabase());
  await closeSupabaseClients();

  if (error) {
    return serviceResult({
      id: 'supabase',
      label: 'Supabase',
      status: 'degraded',
      state: 'error',
      latencyMs,
      error,
    });
  }

  const checks = ping?.checks || {};
  const restOk = checks.rest?.ok;
  const storageOk = checks.storage?.ok;
  const pgOk = checks.postgres?.ok;
  const allOk = Boolean(ping?.ok && restOk && storageOk && (pgOk !== false));

  return serviceResult({
    id: 'supabase',
    label: 'Supabase',
    status: allOk ? 'ok' : 'degraded',
    state: allOk ? 'connected' : 'partial',
    latencyMs,
    error: allOk ? null : [checks.rest, checks.storage, checks.postgres]
      .filter((c) => c && !c.ok)
      .map((c) => c.message)
      .filter(Boolean)
      .join('; ') || ping?.message || null,
    detail: restOk && storageOk ? 'REST + storage reachable' : null,
  });
}

function resolveAutoMailerApiBase() {
  return String(process.env.AUTO_MAILER_API_URL || '').trim().replace(/\/+$/, '');
}

async function probeAutoMailerBridge() {
  const apiBase = resolveAutoMailerApiBase();
  const token = process.env.AUTO_MAILER_INTERNAL_TOKEN || process.env.COREKNOT_MAIL_BRIDGE_SECRET;
  if (!apiBase) {
    return serviceResult({
      id: 'auto-mailer',
      label: 'Auto-Mailer Bridge',
      status: config.isProduction ? 'degraded' : 'ok',
      state: 'not_configured',
      detail: 'AUTO_MAILER_API_URL not set',
    });
  }

  if (/vercel\.app$/i.test(apiBase) || /auto-mailer-blue/i.test(apiBase)) {
    return serviceResult({
      id: 'auto-mailer',
      label: 'Auto-Mailer Bridge',
      status: 'degraded',
      state: 'invalid_origin',
      error: 'AUTO_MAILER_API_URL must be the Auto-Mailer API origin, not the Vercel UI',
    });
  }

  if (!token) {
    return serviceResult({
      id: 'auto-mailer',
      label: 'Auto-Mailer Bridge',
      status: config.isProduction ? 'degraded' : 'ok',
      state: 'missing_token',
      detail: 'AUTO_MAILER_INTERNAL_TOKEN or COREKNOT_MAIL_BRIDGE_SECRET not set',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const { latencyMs, error } = await withLatency(async () => {
    try {
      const response = await fetch(`${apiBase}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Auto-Mailer returned ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  });

  if (error) {
    return serviceResult({
      id: 'auto-mailer',
      label: 'Auto-Mailer Bridge',
      status: 'degraded',
      state: 'api_error',
      latencyMs,
      error,
    });
  }

  return serviceResult({
    id: 'auto-mailer',
    label: 'Auto-Mailer Bridge',
    status: 'ok',
    state: 'connected',
    latencyMs,
    detail: apiBase,
  });
}

async function probeBullmq() {
  if (!isRedisAvailable()) {
    return serviceResult({
      id: 'bullmq',
      label: 'Job Queues',
      status: config.isProduction ? 'degraded' : 'ok',
      state: 'redis_unavailable',
      detail: 'Queue stats require Redis',
    });
  }

  const { latencyMs, value: snapshot, error } = await withLatency(() => getQueueAdminSnapshot());
  if (error) {
    return serviceResult({
      id: 'bullmq',
      label: 'Job Queues',
      status: 'degraded',
      state: 'error',
      latencyMs,
      error,
    });
  }

  const queues = snapshot?.queues || [];
  const totalFailed = queues.reduce((sum, q) => sum + (q.failed || 0), 0);
  const totalActive = queues.reduce((sum, q) => sum + (q.active || 0), 0);

  return serviceResult({
    id: 'bullmq',
    label: 'Job Queues',
    status: totalFailed > 0 ? 'degraded' : 'ok',
    state: `${queues.length} queues`,
    latencyMs,
    detail: `${totalActive} active, ${totalFailed} failed`,
    error: totalFailed > 0 ? `${totalFailed} failed jobs across queues` : null,
  });
}

function aggregateStatus(services) {
  if (services.some((s) => s.id === 'mongodb' && s.status === 'down')) return 'down';
  if (services.some((s) => s.status === 'down')) return 'degraded';
  if (services.some((s) => s.status === 'degraded')) return 'degraded';
  return 'ok';
}

const HEALTH_CACHE_TTL_MS = Math.max(
  5000,
  Number.parseInt(process.env.SYSTEM_HEALTH_CACHE_MS || '60000', 10) || 60000,
);
let healthCache = null;
let healthCacheAt = 0;

const skipExternalProbes = () => (
  config.NODE_ENV === 'development'
  || String(process.env.SYSTEM_HEALTH_SKIP_EXTERNAL || '').toLowerCase() === 'true'
);

async function getAdminSystemHealth(options = {}) {
  const { forceFullProbes = false, bypassCache = false } = options;
  const now = Date.now();
  if (!bypassCache && healthCache && now - healthCacheAt < HEALTH_CACHE_TTL_MS) {
    return healthCache;
  }

  const light = !forceFullProbes && skipExternalProbes();
  const services = await Promise.all([
    probeMongo(),
    probeRedis(),
    light
      ? Promise.resolve(serviceResult({
        id: 'supabase',
        label: 'Supabase',
        status: 'ok',
        state: 'skipped_local',
        detail: 'External probe skipped in development',
      }))
      : probeSupabase(),
    light
      ? Promise.resolve(serviceResult({
        id: 'auto-mailer',
        label: 'Auto-Mailer Bridge',
        status: 'ok',
        state: 'skipped_local',
        detail: 'External probe skipped in development',
      }))
      : probeAutoMailerBridge(),
    probeBullmq(),
  ]);

  const status = aggregateStatus(services);
  const checkedAt = new Date().toISOString();

  const report = {
    status,
    ok: status === 'ok',
    checkedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    services,
  };

  healthCache = report;
  healthCacheAt = now;
  return report;
}

module.exports = {
  getAdminSystemHealth,
};
