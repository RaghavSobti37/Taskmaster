const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const path = require('path');
const { getRedisUrl } = require('../utils/wslRedis');
const logger = require('../utils/logger');

const redisUrl = getRedisUrl();

let redisConnection = null;
let redisAvailable = false;

// Create Redis connection for BullMQ
try {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 2000,
    lazyConnect: true,
    retryStrategy: () => null
  });

  redisConnection.connect()
    .then(() => {
      logger.info('Queue', 'Redis connected. BullMQ active.');
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
let csvBackupPending = false;
let batchTimeout = null;
const HOLY_SHEET_BATCH_MAX = 100;
const HOLY_SHEET_BATCH_DELAY_MS = 10000;

function initializeQueues() {
  holySheetQueue = new Queue('holySheetQueue', { connection: redisConnection });
  csvBackupQueue = new Queue('csvBackupQueue', { connection: redisConnection });
  gamificationQueue = new Queue('gamificationQueue', { connection: redisConnection });

  // BullMQ Worker to process HolySheet queue in batches every 10s
  const holySheetWorker = new Worker('holySheetQueue', async (job) => {
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
  const csvWorker = new Worker('csvBackupQueue', async (job) => {
    logger.info('Queue Worker', 'Executing CSV backup...');
    const csvBackupService = require('./csvBackupService');
    await csvBackupService.backupAllLeadsToCsv();
  }, { connection: redisConnection, concurrency: 1 });
  // Worker for Gamification
  const gamificationWorker = new Worker('gamificationQueue', async (job) => {
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



const queueGamificationEvent = async (eventType, payload) => {
  const runEvent = async () => {
    const GamificationService = require('./gamificationService');
    await GamificationService.handleGamificationEvent(eventType, payload);
  };

  if (redisAvailable && gamificationQueue) {
    try {
      await gamificationQueue.add(eventType, { eventType, payload }, { removeOnComplete: true, removeOnFail: false });
    } catch (e) {
      logger.error('Queue', 'Gamification queue failed — running inline', { error: e.message });
      setImmediate(runEvent);
    }
  } else {
    setImmediate(runEvent);
  }
};

module.exports = {
  queueHolySheetSync,
  queueCsvBackup,
  queueGamificationEvent
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

// Kickoff cron
setTimeout(startAnalyticsCron, 5000);
