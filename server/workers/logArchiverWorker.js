const logger = require('../utils/logger');

/** @deprecated Logs and CRM audits now use 7-day MongoDB TTL indexes — no archival needed. */
const initLogArchiverWorker = () => {
  logger.info('logArchiverWorker', 'Skipped — Log, SystemLog, and CRMAudit use 7-day TTL');
};

module.exports = { initLogArchiverWorker };
