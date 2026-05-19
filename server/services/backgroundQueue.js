const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const path = require('path');

let redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

if (process.platform === 'win32' && (!process.env.REDIS_URL || process.env.REDIS_URL.includes('127.0.0.1') || process.env.REDIS_URL.includes('localhost'))) {
  try {
    const { execSync } = require('child_process');
    const wslIp = execSync('wsl hostname -I').toString().trim().split(' ')[0];
    if (wslIp) {
      redisUrl = `redis://${wslIp}:6379`;
      console.log(`[SYSTEM] Windows detected. Using WSL Redis IP: ${redisUrl}`);
    }
  } catch (err) {
    // Silent fallback
  }
}

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
      console.log('[Queue] Redis connected. BullMQ active.');
      redisAvailable = true;
      initializeQueues();
    })
    .catch((err) => {
      console.warn('[Queue Warning] Redis connect failed. Falling back to memory-based delayed execution.', err.message);
      redisAvailable = false;
      if (redisConnection) {
        try { redisConnection.disconnect(); } catch (e) {}
      }
      initializeMemoryQueues();
    });

  redisConnection.on('error', (err) => {
    // Avoid crashing on connection loss
    if (redisAvailable) {
      console.warn('[Queue Warning] Redis connection lost. Switching to memory queue.');
      redisAvailable = false;
      if (redisConnection) {
        try { redisConnection.disconnect(); } catch (e) {}
      }
      initializeMemoryQueues();
    }
  });
} catch (err) {
  console.warn('[Queue Exception] Failed to initialize Redis. Falling back to memory queues.', err.message);
  redisAvailable = false;
  initializeMemoryQueues();
}

let holySheetQueue = null;
let csvBackupQueue = null;

// Memory storage for fallback de-duplication
const pendingHolySheetIds = new Set();
let csvBackupPending = false;
let batchTimeout = null;

function initializeQueues() {
  holySheetQueue = new Queue('holySheetQueue', { connection: redisConnection });
  csvBackupQueue = new Queue('csvBackupQueue', { connection: redisConnection });

  // BullMQ Worker to process HolySheet queue in batches every 10s
  const holySheetWorker = new Worker('holySheetQueue', async (job) => {
    const { leadIds } = job.data;
    if (!leadIds || leadIds.length === 0) return;
    console.log(`[Queue Worker] Processing batch sync to HolySheet for ${leadIds.length} leads.`);
    
    const Lead = require('../models/Lead');
    const holySheetService = require('./holySheetService');
    
    // Fetch fresh copies of all leads in this batch
    const leads = await Lead.find({ _id: { $in: leadIds } });
    for (const lead of leads) {
      await holySheetService.syncLeadToSheet(lead);
      // Brief delay to respect Google Sheets rate limit
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }, { connection: redisConnection, concurrency: 1 });

  // Worker for CSV backup
  const csvWorker = new Worker('csvBackupQueue', async (job) => {
    console.log('[Queue Worker] Executing CSV backup...');
    const csvBackupService = require('./csvBackupService');
    await csvBackupService.backupAllLeadsToCsv();
  }, { connection: redisConnection, concurrency: 1 });

  holySheetWorker.on('failed', (job, err) => {
    console.error(`[Queue Worker] HolySheet job failed: ${err.message}`);
  });

  csvWorker.on('failed', (job, err) => {
    console.error(`[Queue Worker] CSV backup job failed: ${err.message}`);
  });
}

function initializeMemoryQueues() {
  console.log('[Queue] In-memory scheduler initialized.');
}

// Main API to queue HolySheet sync
const queueHolySheetSync = (leadId) => {
  const cleanId = String(leadId);
  if (redisAvailable && holySheetQueue) {
    // Accumulate in memory first and schedule a batch write
    pendingHolySheetIds.add(cleanId);
    scheduleRedisBatch();
  } else {
    // Memory fallback
    pendingHolySheetIds.add(cleanId);
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
        console.log(`[Queue] Added batch of ${idsToSync.length} leads to HolySheet queue.`);
      } catch (err) {
        console.error('[Queue Error] Failed to add job to BullMQ, executing inline:', err.message);
        // Fallback to direct async
        executeHolySheetSyncDirect(idsToSync);
      }
    }
  }, 10000); // 10 seconds batch
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
        console.error('[Queue Error] Failed to add CSV job to BullMQ, executing inline:', err.message);
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
      console.log(`[Memory Queue] Executing batch sync for ${idsToSync.length} leads.`);
      executeHolySheetSyncDirect(idsToSync);
    }
  }, 10000);
}

let memoryCsvTimeout = null;
function scheduleMemoryCsv() {
  if (memoryCsvTimeout) return;
  memoryCsvTimeout = setTimeout(async () => {
    memoryCsvTimeout = null;
    if (csvBackupPending) {
      csvBackupPending = false;
      console.log('[Memory Queue] Executing CSV backup.');
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
    const leads = await Lead.find({ _id: { $in: ids } });
    for (const lead of leads) {
      await holySheetService.syncLeadToSheet(lead);
      await new Promise(r => setTimeout(r, 100)); // Sleep to prevent rate limit
    }
  } catch (err) {
    console.error('[Memory Queue Error] Direct sync failed:', err.message);
  }
}

module.exports = {
  queueHolySheetSync,
  queueCsvBackup
};
