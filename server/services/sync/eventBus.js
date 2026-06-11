/**
 * Event-driven domain sync scaffold (BullMQ queue: domain-sync).
 * Phase 1: publish + stub handlers; Mongo remains write authority.
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { getRedisUrl } = require('../../utils/wslRedis');
const logger = require('../../utils/logger');
const { DOMAIN_SYNC_EVENT_TYPES } = require('../../../shared/dataOwnership');
const { handleDomainSyncJob } = require('./handlers/routeSyncHandler');

const DOMAIN_SYNC_QUEUE_NAME = 'domain-sync';
const isTestEnv = process.env.NODE_ENV === 'test';

const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: 200,
  removeOnFail: 500,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};

let redisConnection = null;
let redisAvailable = false;
let domainSyncQueue = null;
let domainSyncWorker = null;
let memoryQueue = [];
let memoryProcessing = false;

function buildJobId(eventType, payload = {}) {
  const entityId = payload.id || payload._id || payload.entityId || 'unknown';
  const version = payload.updatedAt || payload.version || payload.timestamp || '';
  return `${eventType}:${entityId}:${version}`.slice(0, 200);
}

function getRedisConnection() {
  if (redisConnection) return redisConnection;
  redisConnection = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    connectTimeout: 2000,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  redisConnection.on('error', () => {});
  return redisConnection;
}

async function ensureRedis() {
  if (redisAvailable) return true;
  if (isTestEnv) return false;
  try {
    const conn = getRedisConnection();
    if (conn.status !== 'ready') await conn.connect();
    redisAvailable = true;
    return true;
  } catch (err) {
    logger.warn('domainSync', 'Redis unavailable — memory fallback', { error: err.message });
    redisAvailable = false;
    return false;
  }
}

function initializeDomainSyncQueue() {
  if (domainSyncQueue || isTestEnv) return;
  domainSyncQueue = new Queue(DOMAIN_SYNC_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

async function processMemoryQueue() {
  if (memoryProcessing) return;
  memoryProcessing = true;
  while (memoryQueue.length > 0) {
    const jobData = memoryQueue.shift();
    try {
      await handleDomainSyncJob({ id: 'memory', data: jobData });
    } catch (err) {
      logger.warn('domainSync', 'Memory job failed', { error: err.message });
    }
  }
  memoryProcessing = false;
}

/**
 * Publish a domain sync event. Idempotent via deterministic jobId.
 */
async function publishDomainEvent(eventType, payload = {}, options = {}) {
  if (!DOMAIN_SYNC_EVENT_TYPES.includes(eventType)) {
    logger.warn('domainSync', 'Unknown event type — publishing anyway', { eventType });
  }

  const jobData = {
    eventType,
    payload,
    tenantId: options.tenantId || payload.tenantId,
    entityId: options.entityId || payload.id || payload._id,
    publishedAt: new Date().toISOString(),
  };

  const jobOpts = {
    ...DEFAULT_JOB_OPTIONS,
    jobId: options.jobId || buildJobId(eventType, payload),
  };

  if (await ensureRedis()) {
    initializeDomainSyncQueue();
    if (domainSyncQueue) {
      try {
        await domainSyncQueue.add(eventType, jobData, jobOpts);
        return { queued: true, queue: DOMAIN_SYNC_QUEUE_NAME, jobId: jobOpts.jobId };
      } catch (err) {
        logger.warn('domainSync', 'Queue add failed — inline memory', { error: err.message });
      }
    }
  }

  memoryQueue.push(jobData);
  processMemoryQueue().catch(() => {});
  return { queued: true, queue: 'memory', jobId: jobOpts.jobId };
}

function initDomainSyncWorker() {
  if (domainSyncWorker || isTestEnv) return;

  ensureRedis()
    .then((ok) => {
      if (!ok) {
        logger.debug('domainSync', 'Worker skipped — Redis not available');
        return;
      }
      initializeDomainSyncQueue();
      domainSyncWorker = new Worker(
        DOMAIN_SYNC_QUEUE_NAME,
        async (job) => handleDomainSyncJob(job),
        { connection: getRedisConnection(), concurrency: 5 },
      );
      domainSyncWorker.on('failed', (job, err) => {
        logger.error('domainSync', `Job ${job?.id} failed`, { error: err.message });
      });
      logger.debug('domainSync', 'domain-sync BullMQ worker initialized');
    })
    .catch((err) => {
      logger.warn('domainSync', 'Worker init failed', { error: err.message });
    });
}

async function shutdownDomainSync() {
  if (domainSyncWorker) {
    await domainSyncWorker.close().catch(() => {});
    domainSyncWorker = null;
  }
  if (domainSyncQueue) {
    await domainSyncQueue.close().catch(() => {});
    domainSyncQueue = null;
  }
  if (redisConnection) {
    try { redisConnection.disconnect(); } catch (e) {}
    redisConnection = null;
  }
  redisAvailable = false;
  memoryQueue = [];
}

module.exports = {
  DOMAIN_SYNC_QUEUE_NAME,
  DEFAULT_JOB_OPTIONS,
  publishDomainEvent,
  initDomainSyncWorker,
  shutdownDomainSync,
  isDomainSyncRedisAvailable: () => redisAvailable,
};
