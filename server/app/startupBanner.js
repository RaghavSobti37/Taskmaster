const mongoose = require('mongoose');
const { config } = require('../config');
const { getApiDomainManifest } = require('./registerRoutes');
const { CRON_JOBS, QUEUE_WORKERS } = require('../jobs/registry');
const { isRedisAvailable } = require('../services/backgroundQueue');
const { resolveTrackingApiBaseUrl, getTrackingDbMismatchWarning } = require('../utils/trackingUrls');
const { isSupabaseEnabled, getSupabaseConfig } = require('../config/supabase');

let printed = false;
let trackingWarnShown = false;

function formatDomainList(domains, max = 8) {
  if (domains.length <= max) return domains.join(', ');
  return `${domains.slice(0, max).join(', ')} +${domains.length - max} more`;
}

function mongoStatus() {
  const state = mongoose.connection.readyState;
  if (state === 1) {
    const db = mongoose.connection.db?.databaseName || 'unknown';
    return `connected — ${db}`;
  }
  if (state === 2) return 'connecting…';
  return 'disconnected';
}

function redisStatus() {
  return isRedisAvailable() ? 'connected (BullMQ)' : 'unavailable — memory fallback';
}

function printStartupBanner({ jobsStarted = [], jobsSkipped = 0 } = {}) {
  if (printed || config.isTest) return;
  printed = true;

  const { domains } = getApiDomainManifest();
  const registryTotal = CRON_JOBS.length + QUEUE_WORKERS.length;
  const startedCount = jobsStarted.length;

  console.log('[BOOT] ── CoreKnot Express modular monolith ──');
  console.log(`[BOOT] ${config.NODE_ENV} · port ${config.PORT}`);
  console.log(`[BOOT] Domains: ${domains.length} mounted — ${formatDomainList(domains)}`);
  console.log(`[BOOT] MongoDB: ${mongoStatus()}`);
  console.log(`[BOOT] Redis: ${redisStatus()}`);
  console.log(
    `[BOOT] Jobs: ${startedCount}/${registryTotal} started` +
      ` (${CRON_JOBS.length} cron + ${QUEUE_WORKERS.length} workers` +
      (jobsSkipped ? `, ${jobsSkipped} deduped` : '') +
      ')',
  );

  const trackingBase = resolveTrackingApiBaseUrl();
  console.log(`[BOOT] Mail tracking base: ${trackingBase}`);
  const trackingWarn = getTrackingDbMismatchWarning();
  if (trackingWarn && !trackingWarnShown) {
    trackingWarnShown = true;
    console.warn('[MAIL] ⚠ ' + trackingWarn);
  }

  if (isSupabaseEnabled()) {
    const sb = getSupabaseConfig();
    console.log(`[BOOT] Supabase: enabled — ${sb.url}`);
  } else {
    console.log('[BOOT] Supabase: disabled');
  }

  if (config.isDevelopment) {
    const nestPort = process.env.NESTJS_PORT || '5001';
    console.log(`[BOOT] Strangler: attendance → NestJS :${nestPort} (vite proxy)`);
  }
}

function resetStartupBannerForTests() {
  printed = false;
  trackingWarnShown = false;
}

module.exports = { printStartupBanner, resetStartupBannerForTests };
