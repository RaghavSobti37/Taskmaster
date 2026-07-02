/**
 * Registry of background jobs — cron schedules and BullMQ workers.
 * Initialized from app/startServer.js onServerListening.
 */

const CRON_JOBS = [
  {
    id: 'stats-snapshot',
    module: '../workers/statsWorker',
    init: 'initWorker',
    schedule: '*/5 * * * *',
    description: 'CRM stat snapshots for dashboard',
  },
  {
    id: 'task-activity-purge',
    module: '../workers/taskActivityPurgeWorker',
    init: 'init',
    schedule: '15 3 * * *',
    description: 'Purge old task activity logs',
  },
  {
    id: 'notification-minute',
    module: '../services/notificationService',
    init: 'init',
    schedule: '* * * * *',
    description: 'Due-date and reminder notifications',
  },
  {
    id: 'notification-daily',
    module: '../services/notificationService',
    init: 'init',
    schedule: '30 18 * * *',
    description: 'Daily digest notifications',
  },
  {
    id: 'supabase-sync',
    module: '../workers/supabaseSyncWorker',
    init: 'initSupabaseSyncWorker',
    schedule: '15 */6 * * *',
    description: 'Mirror Mongo changes to Supabase',
  },
  {
    id: 'knowledge-engine-scheduler',
    module: '../workers/knowledgeEngineScheduler',
    init: 'initKnowledgeEngineScheduler',
    schedule: '0 0 * * *',
    description: 'Knowledge Engine daily cron registration',
  },
];

const QUEUE_WORKERS = [
  {
    id: 'webhook',
    module: '../workers/webhookWorker',
    init: 'initWebhookWorker',
    queue: 'webhook',
    description: 'Async webhook event processing',
  },
  {
    id: 'import',
    module: '../workers/importWorker',
    init: 'initImportWorker',
    queue: 'import',
    description: 'CRM / data import jobs',
  },
  {
    id: 'supabase-sync-worker',
    module: '../workers/supabaseSyncWorker',
    init: 'initSupabaseSyncWorker',
    queue: 'supabase-sync',
    description: 'BullMQ supabase sync consumer',
  },
  {
    id: 'domain-sync',
    module: '../workers/domainSyncWorker',
    init: 'initWorker',
    queue: 'domain-sync',
    description: 'Event-driven hybrid domain sync (ownership-routed writers)',
  },
  {
    id: 'campaign-email',
    module: '../workers/campaignEmailWorker',
    init: 'initCampaignEmailWorker',
    queue: 'campaign-email',
    description: 'Background campaign email dispatch (BullMQ)',
  },
  {
    id: 'knowledge-engine',
    module: '../workers/knowledgeEngineWorker',
    init: 'initKnowledgeEngineWorker',
    queue: 'knowledge-engine',
    description: 'TSC Knowledge Engine content pipeline (BullMQ)',
  },
];

function listJobs() {
  return { cron: CRON_JOBS, workers: QUEUE_WORKERS };
}

module.exports = {
  CRON_JOBS,
  QUEUE_WORKERS,
  listJobs,
};
