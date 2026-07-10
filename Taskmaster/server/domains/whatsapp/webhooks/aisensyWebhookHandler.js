const {
  processAisensyWebhook,
} = require('../../../services/aisensyCampaignSyncService');
const { runWithWorkerTenant } = require('../../../utils/workerTenantContext');
const {
  resolveTenantByWebhookSecret,
  resolveTenantByVerifyToken,
} = require('../../integrations-hub/services/aisensyIntegrationService');
const logger = require('../../../utils/logger');

async function handleAisensyWebhookVerify(req, res) {
  const mode = req.query['hub.mode'] || req.query.hub?.mode;
  const token = req.query['hub.verify_token'] || req.query.hub?.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.hub?.challenge;
  const received = (token || '').replace(/['"]/g, '').trim();

  if (mode === 'subscribe') {
    const tenantId = await resolveTenantByVerifyToken(received);
    if (tenantId && challenge) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }
  }
  return res.status(403).send('Validation Failed');
}

async function handleAisensyWebhook(req, res) {
  const header = req.headers['x-aisensy-signature']
    || req.headers['x-webhook-secret']
    || req.headers.authorization;
  const tenantId = await resolveTenantByWebhookSecret(header);
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({ ok: true, accepted: true });

  setImmediate(async () => {
    try {
      await runWithWorkerTenant(String(tenantId), async () => {
        const stats = await processAisensyWebhook(req.body);
        logger.info('aisensyWebhook', 'sync complete', stats);
      });
    } catch (error) {
      logger.error('aisensyWebhook', 'sync failed', { error: error.message });
    }
  });
}

module.exports = {
  handleAisensyWebhookVerify,
  handleAisensyWebhook,
};
