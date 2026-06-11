/**
 * Mongo cold-archive TTL — bulk write collections retained 90 days.
 * Hot reads for system logs use Supabase when LOGS_PRIMARY_SUPABASE=true.
 */

/** 90 days in seconds — MongoDB expireAfterSeconds */
const COLD_ARCHIVE_TTL_SECONDS = 90 * 24 * 60 * 60;

/** Mongoose schema `expires` shorthand */
const COLD_ARCHIVE_TTL_MONGOOSE = '90d';

/** Collections that should carry a TTL index on their expiry date field */
const COLD_ARCHIVE_COLLECTIONS = [
  { model: 'SystemLog', collection: 'systemlogs', field: 'createdAt' },
  { model: 'Log', collection: 'logs', field: 'createdAt' },
  { model: 'CRMAudit', collection: 'crmaudits', field: 'timestamp' },
  { model: 'MailEvent', collection: 'mailevents', field: 'createdAt' },
  { model: 'QATestRun', collection: 'qaTestRuns', field: 'createdAt' },
  { model: 'TaskActivity', collection: 'taskactivities', field: 'createdAt' },
];

module.exports = {
  COLD_ARCHIVE_TTL_SECONDS,
  COLD_ARCHIVE_TTL_MONGOOSE,
  COLD_ARCHIVE_COLLECTIONS,
};
