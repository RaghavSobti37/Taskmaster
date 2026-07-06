const integrationService = require('../../integrations-hub/services/integrationService');
const { getAdapter } = require('../../integrations-hub/adapters/adapterRegistry');
const { unpackCredentials } = require('../../integrations-hub/services/integrationCredentialService');
const logger = require('../../../utils/logger');

/**
 * Send via tenant-connected Gmail OAuth integration.
 * @returns {object|null} Gmail API response or null if no integration
 */
async function sendViaGmailIntegration({ tenantId, to, subject, html, from }) {
  if (!tenantId) return null;
  const doc = await integrationService.getConnectedIntegration(tenantId, 'gmail');
  if (!doc) return null;

  let credentials = unpackCredentials(doc.credentialsEncrypted);
  const adapter = getAdapter('gmail');

  if (doc.tokenExpiresAt && new Date(doc.tokenExpiresAt) < new Date() && adapter.refreshToken) {
    try {
      credentials = await adapter.refreshToken(credentials);
      const { packCredentials } = require('../../integrations-hub/services/integrationCredentialService');
      doc.credentialsEncrypted = packCredentials(credentials);
      doc.tokenExpiresAt = credentials.expiresAt || doc.tokenExpiresAt;
      await doc.save();
    } catch (err) {
      doc.status = 'reauth_required';
      doc.lastError = err.message;
      await doc.save();
      throw err;
    }
  }

  const result = await adapter.sendEmail(credentials, { to, subject, html, from: from || credentials.email });
  logger.info('mail', `Gmail API email dispatched to: ${Array.isArray(to) ? to.join(', ') : to}`);
  return result;
}

module.exports = {
  sendViaGmailIntegration,
};
