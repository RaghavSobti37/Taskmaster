/**
 * Bridge Knowledge Engine ConnectedAccount reads through integration hub (phase 5).
 */
const ConnectedAccount = require('../knowledge-engine/models/ConnectedAccount');
const TenantIntegration = require('./models/TenantIntegration');
const { serializeConnection } = require('./services/integrationService');

const KE_PROVIDER_MAP = {
  gsc: { provider: 'google_sheets', category: 'analytics' },
  ga4: { provider: 'google_sheets', category: 'analytics' },
  google_trends: { provider: 'google_sheets', category: 'analytics' },
  meta: { provider: 'slack', category: 'custom' },
  linkedin: { provider: 'slack', category: 'custom' },
  medium: { provider: 'slack', category: 'custom' },
  website: { provider: 'webhook_in', category: 'custom' },
};

async function listKnowledgeEngineConnections(tenantId) {
  const [keAccounts, hubConnections] = await Promise.all([
    ConnectedAccount.find({ tenantId }).setOptions({ bypassTenant: true }).lean(),
    TenantIntegration.find({ tenantId, category: 'analytics' }).setOptions({ bypassTenant: true }),
  ]);

  const hubByProvider = new Map(hubConnections.map((c) => [c.provider, c]));

  return keAccounts.map((ke) => {
    const mapped = KE_PROVIDER_MAP[ke.provider];
    const hub = mapped ? hubByProvider.get(mapped.provider) : null;
    return {
      ...ke,
      integrationHub: hub ? serializeConnection(hub) : null,
      hubAlias: mapped?.provider || null,
    };
  });
}

module.exports = {
  KE_PROVIDER_MAP,
  listKnowledgeEngineConnections,
};
