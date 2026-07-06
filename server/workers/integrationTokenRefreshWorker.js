/**
 * Refresh OAuth tokens for tenant integrations before expiry.
 */
const { refreshExpiringTokens } = require('../domains/integrations-hub/services/integrationService');
const logger = require('../utils/logger');

async function runIntegrationTokenRefresh() {
  try {
    const result = await refreshExpiringTokens();
    logger.info('integrationTokenRefresh', 'completed', result);
    return result;
  } catch (err) {
    logger.error('integrationTokenRefresh', err.message);
    throw err;
  }
}

function initIntegrationTokenRefreshWorker() {
  return { run: runIntegrationTokenRefresh };
}

module.exports = {
  runIntegrationTokenRefresh,
  initIntegrationTokenRefreshWorker,
};
