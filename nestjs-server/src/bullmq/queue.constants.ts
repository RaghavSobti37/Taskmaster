/** BullMQ queue names — aligned with server/jobs/registry.js QUEUE_WORKERS. */
export const WEBHOOK_QUEUE = 'webhook';
export const TRACKING_QUEUE = 'tracking';
export const IMPORT_QUEUE = 'import';
export const SUPABASE_SYNC_QUEUE = 'supabase-sync';

/** Phase 5 mail job names */
export const TRACKING_JOB_OPEN = 'track:open';
export const TRACKING_JOB_CLICK = 'track:click';
export const WEBHOOK_JOB_RESEND = 'webhook:resend';

export const QUEUE_NAMES = [
  WEBHOOK_QUEUE,
  TRACKING_QUEUE,
  IMPORT_QUEUE,
  SUPABASE_SYNC_QUEUE,
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
