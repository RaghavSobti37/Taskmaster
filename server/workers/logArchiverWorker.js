const logger = require('../utils/logger');

/** @deprecated Logs and CRM audits use 90-day Mongo cold-archive TTL — no worker archival needed. */
const initLogArchiverWorker = () => {
  logger.debug('logArchiverWorker', 'Skipped — Log, SystemLog, and CRMAudit use 90-day cold-archive TTL');
};

module.exports = { initLogArchiverWorker };
