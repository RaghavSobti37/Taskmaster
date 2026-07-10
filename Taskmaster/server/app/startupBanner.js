const mongoose = require('mongoose');
const { config } = require('../config');
const logger = require('../utils/logger');
const { getApiDomainManifest } = require('./registerRoutes');
const { CRON_JOBS, QUEUE_WORKERS } = require('../jobs/registry');
const { isRedisAvailable } = require('../services/backgroundQueue');
const { validateUploadthingCredentials } = require('../utils/uploadthingCredentials');
const { isSupabaseEnabled, getSupabaseConfig } = require('../config/supabase');

let printed = false;

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

  logger.info('BOOT', '── CoreKnot Express modular monolith ──');
  logger.info('BOOT', `${config.NODE_ENV} · port ${config.PORT}`);
  logger.info('BOOT', `Domains: ${domains.length} mounted — ${formatDomainList(domains)}`);
  logger.info('BOOT', `MongoDB: ${mongoStatus()}`);
  logger.info('BOOT', `Redis: ${redisStatus()}`);
  logger.info(
    'BOOT',
    `Jobs: ${startedCount}/${registryTotal} started` +
      ` (${CRON_JOBS.length} cron + ${QUEUE_WORKERS.length} workers` +
      (jobsSkipped ? `, ${jobsSkipped} deduped` : '') +
      ')',
  );

  if (isSupabaseEnabled()) {
    const sb = getSupabaseConfig();
    logger.info('BOOT', `Supabase: enabled — ${sb.url}`);
  } else {
    logger.info('BOOT', 'Supabase: disabled');
  }

  if (config.isDevelopment) {
    const nestPort = process.env.NESTJS_PORT || '5001';
    logger.info('BOOT', `Strangler: attendance → NestJS :${nestPort} (vite proxy)`);
  }

  const uploadCreds = validateUploadthingCredentials();
  if (!uploadCreds.ok) {
    logger.warn('BOOT', `UploadThing: misconfigured — ${uploadCreds.message}`);
  } else {
    logger.info('BOOT', `UploadThing: ready${uploadCreds.appId ? ` — ${uploadCreds.appId}` : ''}`);
  }
}

function resetStartupBannerForTests() {
  printed = false;
  
}

module.exports = { printStartupBanner, resetStartupBannerForTests };
