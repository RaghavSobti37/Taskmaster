const logger = require('../utils/logger');
const { cronJobsEnabled } = require('../utils/runtimeFlags');
const { CRON_JOBS, QUEUE_WORKERS } = require('./registry');

function resolveInitFn(entry) {
  const mod = require(entry.module);
  const initFn = mod[entry.init];
  if (typeof initFn !== 'function') {
    throw new Error(`Job "${entry.id}": export "${entry.init}" missing in ${entry.module}`);
  }
  return initFn;
}

/**
 * Start all cron schedulers and BullMQ workers registered in jobs/registry.js.
 * Deduplicates by module+init so shared handlers (e.g. notificationService.init) run once.
 */
function bootstrapBackgroundJobs() {
  const seen = new Set();
  const started = [];
  let skipped = 0;

  const cronEntries = cronJobsEnabled() ? CRON_JOBS : [];
  if (!cronJobsEnabled() && CRON_JOBS.length) {
    logger.info('jobs', 'Skipping in-process cron schedulers (COREKNOT_LIGHTWEIGHT or COREKNOT_DISABLE_CRON)');
  }

  for (const entry of [...cronEntries, ...QUEUE_WORKERS]) {
    const key = `${entry.module}::${entry.init}`;
    if (seen.has(key)) {
      skipped += 1;
      logger.debug('jobs', `Skipping duplicate init for ${entry.id}`);
      continue;
    }
    seen.add(key);

    try {
      resolveInitFn(entry)();
      started.push(entry.id);
      const suffix = entry.queue ? ` (queue: ${entry.queue})` : entry.schedule ? ` (cron: ${entry.schedule})` : '';
      logger.debug('jobs', `Started ${entry.id}${suffix}`);
    } catch (err) {
      logger.error('jobs', `Failed to start ${entry.id}`, { error: err.message });
    }
  }

  return { jobsStarted: started, jobsSkipped: skipped };
}

module.exports = { bootstrapBackgroundJobs, resolveInitFn };
