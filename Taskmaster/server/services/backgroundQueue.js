const { Queue, Worker } = require('bullmq');
const mongoose = require('mongoose');
const path = require('path');
const { getRedisUrl, createRedisClient } = require('../utils/wslRedis');
const logger = require('../utils/logger');

const MONGO_READY_TIMEOUT_MS = 30000;

async function waitForMongoReady(timeoutMs = MONGO_READY_TIMEOUT_MS) {
  if (mongoose.connection.readyState === 1) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (mongoose.connection.readyState === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('MongoDB not ready');
}

async function pruneStaleFailedJobs() {
  const targets = [
    { label: 'gamificationQueue', queue: gamificationQueue },
    { label: 'holySheetQueue', queue: holySheetQueue },
    { label: 'csvBackupQueue', queue: csvBackupQueue },
  ];
  for (const { label, queue } of targets) {
    if (!queue) continue;
    try {
      const count = await queue.getFailedCount();
      if (count > 0) {
        await queue.clean(0, count, 'failed');
        logger.info('Queue', `Pruned ${count} stale failed jobs from ${label}`);
      }
    } catch (err) {
      logger.warn('Queue', `Failed to prune ${label}`, { error: err.message });
    }
  }
}

const redisUrl = getRedisUrl();
const isTestEnv = process.env.NODE_ENV === 'test';

let redisConnection = null;
let redisAvailable = false;
let holySheetWorker = null;
let csvWorker = null;
let gamificationWorker = null;

// Jest: skip Redis/BullMQ — workers leak and log after suite teardown
if (isTestEnv) {
  initializeMemoryQueues();
} else try {
  redisConnection = createRedisClient();

  redisConnection.connect()
    .then(() => {
      logger.debug('Queue', 'Redis connected. BullMQ active.');
      redisAvailable = true;
      initializeQueues();
    })
    .catch((err) => {
      logger.warn('Queue', 'Redis connect failed. Falling back to memory-based delayed execution.', { error: err.message });
      redisAvailable = false;
      if (redisConnection) {
        try { redisConnection.disconnect(); } catch (e) {}
      }
      initializeMemoryQueues();
    });

  redisConnection.on('error', (err) => {
    // Avoid crashing on connection loss
    if (redisAvailable) {
      logger.warn('Queue', 'Redis connection lost. Switching to memory queue.');
      redisAvailable = false;
      if (redisConnection) {
        try { redisConnection.disconnect(); } catch (e) {}
      }
      initializeMemoryQueues();
    }
  });
} catch (err) {
  logger.warn('Queue', 'Failed to initialize Redis. Falling back to memory queues.', { error: err.message });
  redisAvailable = false;
  initializeMemoryQueues();
}

let holySheetQueue = null;
let csvBackupQueue = null;
let gamificationQueue = null;

// Memory storage for fallback de-duplication
const pendingHolySheetIds = new Set();
const pendingGamificationRuns = new Set();
let csvBackupPending = false;
let batchTimeout = null;
const HOLY_SHEET_BATCH_MAX = 100;
const HOLY_SHEET_BATCH_DELAY_MS = 10000;

function initializeQueues() {
  holySheetQueue = new Queue('holySheetQueue', { connection: redisConnection });
  csvBackupQueue = new Queue('csvBackupQueue', { connection: redisConnection });
  gamificationQueue = new Queue('gamificationQueue', { connection: redisConnection });

  // BullMQ Worker to process HolySheet queue in batches every 10s
  holySheetWorker = new Worker('holySheetQueue', async (job) => {
    const { leadIds } = job.data;
    if (!leadIds || leadIds.length === 0) return;
    logger.info('Queue Worker', `Processing batch sync to HolySheet for ${leadIds.length} leads.`);
    
    const Lead = require('../models/Lead');
    const holySheetService = require('./holySheetService');
    
    // Fetch fresh copies of all leads in this batch
    const leads = await Lead.find({ _id: { $in: leadIds } }).lean();
    for (const lead of leads) {
      await holySheetService.syncLeadToSheet(lead);
      // Brief delay to respect Google Sheets rate limit
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }, { connection: redisConnection, concurrency: 1 });

  // Worker for CSV backup
  csvWorker = new Worker('csvBackupQueue', async (job) => {
    logger.info('Queue Worker', 'Executing CSV backup...');
    const csvBackupService = require('./csvBackupService');
    await csvBackupService.backupAllLeadsToCsv();
  }, { connection: redisConnection, concurrency: 1 });
  // Worker for Gamification — wait for Mongo so jobs don't fail with buffer timeouts on cold start
  gamificationWorker = new Worker('gamificationQueue', async (job) => {
    await waitForMongoReady();
    const { eventType, payload } = job.data;
    const GamificationService = require('./gamificationService');
    await GamificationService.handleGamificationEvent(eventType, payload);
  }, { connection: redisConnection, concurrency: 5 });

  gamificationWorker.on('failed', (job, err) => {
    logger.error('Queue Worker', `Gamification job failed: ${err.message}`);
  });


  holySheetWorker.on('failed', (job, err) => {
    logger.error('Queue Worker', `HolySheet job failed: ${err.message}`);
  });

  csvWorker.on('failed', (job, err) => {
    logger.error('Queue Worker', `CSV backup job failed: ${err.message}`);
  });

  pruneStaleFailedJobs().catch((err) => {
    logger.warn('Queue', 'Startup failed-job prune skipped', { error: err.message });
  });
}

function initializeMemoryQueues() {
  logger.info('Queue', 'In-memory scheduler initialized.');
}

function flushHolySheetBatchNow() {
  if (redisBatchTimeout) {
    clearTimeout(redisBatchTimeout);
    redisBatchTimeout = null;
  }
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }

  const idsToSync = Array.from(pendingHolySheetIds);
  pendingHolySheetIds.clear();
  if (idsToSync.length === 0) return;

  if (redisAvailable && holySheetQueue) {
    holySheetQueue.add('batchSync', { leadIds: idsToSync }, {
      removeOnComplete: true,
      removeOnFail: true,
    }).catch((err) => {
      logger.error('Queue', 'Failed to flush HolySheet batch to BullMQ', { error: err.message });
      executeHolySheetSyncDirect(idsToSync);
    });
  } else {
    executeHolySheetSyncDirect(idsToSync);
  }
}

// Main API to queue HolySheet sync
const queueHolySheetSync = (leadId) => {
  const cleanId = String(leadId);
  if (pendingHolySheetIds.size >= HOLY_SHEET_BATCH_MAX) {
    flushHolySheetBatchNow();
  }
  pendingHolySheetIds.add(cleanId);
  if (redisAvailable && holySheetQueue) {
    scheduleRedisBatch();
  } else {
    scheduleMemoryBatch();
  }
};

// Main API to queue CSV backup
const queueCsvBackup = () => {
  if (redisAvailable && csvBackupQueue) {
    csvBackupPending = true;
    scheduleRedisCsv();
  } else {
    csvBackupPending = true;
    scheduleMemoryCsv();
  }
};

// Schedule batch job execution using Redis Queue
let redisBatchTimeout = null;
function scheduleRedisBatch() {
  if (redisBatchTimeout) return;
  redisBatchTimeout = setTimeout(async () => {
    redisBatchTimeout = null;
    const idsToSync = Array.from(pendingHolySheetIds);
    pendingHolySheetIds.clear();

    if (idsToSync.length > 0) {
      try {
        await holySheetQueue.add('batchSync', { leadIds: idsToSync }, {
          removeOnComplete: true,
          removeOnFail: true
        });
        logger.info('Queue', `Added batch of ${idsToSync.length} leads to HolySheet queue.`);
      } catch (err) {
        logger.error('Queue', 'Failed to add job to BullMQ, executing inline', { error: err.message });
        // Fallback to direct async
        executeHolySheetSyncDirect(idsToSync);
      }
    }
  }, HOLY_SHEET_BATCH_DELAY_MS);
}

let redisCsvTimeout = null;
function scheduleRedisCsv() {
  if (redisCsvTimeout) return;
  redisCsvTimeout = setTimeout(async () => {
    redisCsvTimeout = null;
    if (csvBackupPending) {
      csvBackupPending = false;
      try {
        await csvBackupQueue.add('csvBackup', {}, {
          removeOnComplete: true,
          removeOnFail: true
        });
      } catch (err) {
        logger.error('Queue', 'Failed to add CSV job to BullMQ, executing inline', { error: err.message });
        const csvBackupService = require('./csvBackupService');
        csvBackupService.backupAllLeadsToCsv();
      }
    }
  }, 12000); // 12 seconds backup spacing
}

// Memory-only scheduler fallback
function scheduleMemoryBatch() {
  if (batchTimeout) return;
  batchTimeout = setTimeout(async () => {
    batchTimeout = null;
    const idsToSync = Array.from(pendingHolySheetIds);
    pendingHolySheetIds.clear();
    
    if (idsToSync.length > 0) {
      logger.info('Memory Queue', `Executing batch sync for ${idsToSync.length} leads.`);
      executeHolySheetSyncDirect(idsToSync);
    }
  }, HOLY_SHEET_BATCH_DELAY_MS);
}

let memoryCsvTimeout = null;
function scheduleMemoryCsv() {
  if (memoryCsvTimeout) return;
  memoryCsvTimeout = setTimeout(async () => {
    memoryCsvTimeout = null;
    if (csvBackupPending) {
      csvBackupPending = false;
      logger.info('Memory Queue', 'Executing CSV backup.');
      const csvBackupService = require('./csvBackupService');
      csvBackupService.backupAllLeadsToCsv();
    }
  }, 12000);
}

// Helper to run sync directly in non-blocking async
async function executeHolySheetSyncDirect(ids) {
  try {
    const Lead = require('../models/Lead');
    const holySheetService = require('./holySheetService');
    const leads = await Lead.find({ _id: { $in: ids } }).lean();
    for (const lead of leads) {
      await holySheetService.syncLeadToSheet(lead);
      await new Promise(r => setTimeout(r, 100)); // Sleep to prevent rate limit
    }
  } catch (err) {
    logger.error('Memory Queue', 'Direct sync failed', { error: err.message });
  }
}



function trackGamificationRun(promise) {
  if (!isTestEnv) return;
  pendingGamificationRuns.add(promise);
  promise.finally(() => pendingGamificationRuns.delete(promise));
}

/** Wait for fire-and-forget gamification jobs (Jest afterEach, before collection wipe). */
async function drainGamificationMemoryQueue(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (pendingGamificationRuns.size > 0 && Date.now() < deadline) {
    await Promise.allSettled([...pendingGamificationRuns]);
    if (pendingGamificationRuns.size === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const queueGamificationEvent = (eventType, payload) => {
  const job = (async () => {
    const runEvent = async () => {
      const GamificationService = require('./gamificationService');
      await GamificationService.handleGamificationEvent(eventType, payload);
    };

    // QA runs: inline only — avoids Bull waitUntilFinished exceeding HTTP client timeouts
    const { isQaSyncGamification } = require('../utils/qaProbeContext');
    if (isQaSyncGamification()) {
      await runEvent();
      return;
    }

    if (redisAvailable && gamificationQueue) {
      try {
        await gamificationQueue.add(
          eventType,
          { eventType, payload },
          { removeOnComplete: true, removeOnFail: true }
        );
        return;
      } catch (e) {
        logger.error('Queue', 'Gamification queue failed — running inline', { error: e.message });
        await runEvent();
      }
    } else {
      await runEvent();
    }
  })();

  trackGamificationRun(job);
  return job;
};

const getManagedQueues = () => {
  if (!redisAvailable) return [];
  return [
    { name: 'holySheetQueue', queue: holySheetQueue },
    { name: 'csvBackupQueue', queue: csvBackupQueue },
    { name: 'gamificationQueue', queue: gamificationQueue },
  ].filter((entry) => entry.queue);
};

async function shutdownBackgroundQueue() {
  for (const timeout of [redisBatchTimeout, redisCsvTimeout, batchTimeout, memoryCsvTimeout]) {
    if (timeout) clearTimeout(timeout);
  }
  redisBatchTimeout = null;
  redisCsvTimeout = null;
  batchTimeout = null;
  memoryCsvTimeout = null;

  const workers = [holySheetWorker, csvWorker, gamificationWorker].filter(Boolean);
  await Promise.all(workers.map((worker) => worker.close().catch(() => {})));

  const queues = [holySheetQueue, csvBackupQueue, gamificationQueue].filter(Boolean);
  await Promise.all(queues.map((queue) => queue.close().catch(() => {})));

  if (redisConnection) {
    try {
      redisConnection.disconnect();
    } catch (e) {}
    redisConnection = null;
  }
  redisAvailable = false;
}

module.exports = {
  queueHolySheetSync,
  queueCsvBackup,
  queueGamificationEvent,
  drainGamificationMemoryQueue,
  isRedisAvailable: () => redisAvailable,
  getManagedQueues,
  shutdownBackgroundQueue,
};

// Daily cron job for Platform Analytics (Offload Read Path)
function startAnalyticsCron() {
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setInterval(async () => {
    logger.info('Cron Worker', 'Starting periodic analytics sync...');
    try {
      const Artist = require('../models/Artist');
      const { fetchLiveAnalytics } = require('./analyticsService');
      
      const artists = await Artist.find({ 'oauthCredentials.meta.accessToken': { $exists: true } }); // just to find ones with some connection
      
      for (const artist of artists) {
        try {
          const { spotifyRes, youtubeRes, metaRes } = await fetchLiveAnalytics(artist);
          
          const dailySnapshot = {
            timestamp: new Date(),
            platform: 'overall',
            metrics: {
              spotify: {
                followers: spotifyRes?.value?.artistInfo?.followers?.total || 0,
                popularity: spotifyRes?.value?.artistInfo?.popularity || 0
              },
              youtube: {
                subscribers: youtubeRes?.value?.channel?.statistics?.subscriberCount || 0,
                views: youtubeRes?.value?.channel?.statistics?.viewCount || 0
              },
              instagram: {
                followers: metaRes?.value?.followers || 0
              }
            }
          };

          await Artist.findByIdAndUpdate(artist._id, {
            $push: { analyticsHistory: dailySnapshot }
          });
        } catch (err) {
          logger.error('Cron Worker', `Sync failed for artist ${artist._id}`, { error: err.message });
        }
      }
    } catch (err) {
      logger.error('Cron Worker', 'Analytics cron error', { error: err.message });
    }
  }, TWELVE_HOURS);
}

// Kickoff cron (skip in Jest or lightweight mode)
const { backgroundIntervalsEnabled } = require('../utils/runtimeFlags');
if (!isTestEnv && backgroundIntervalsEnabled()) {
  setTimeout(startAnalyticsCron, 5000);
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const { processDueOffboardings } = require('./tenantOffboardingService');
      const count = await processDueOffboardings();
      if (count > 0) {
        logger.info('Cron Worker', `Processed ${count} tenant offboarding job(s)`);
      }
    } catch (err) {
      logger.error('Cron Worker', 'Offboarding cron error', { error: err.message });
    }
  }, TWENTY_FOUR_HOURS);
}
