const mongoose = require('mongoose');
const { resolveDefaultTenantId, resetDefaultTenantCache } = require('../utils/defaultTenant');
const { getTenantId } = require('../utils/tenantContext');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');

describe('defaultTenant webhook context', () => {
  afterEach(() => {
    resetDefaultTenantCache();
  });

  it('resolveDefaultTenantId prefers WEBHOOK_TENANT_ID env', async () => {
    const id = new mongoose.Types.ObjectId();
    process.env.WEBHOOK_TENANT_ID = String(id);
    await expect(resolveDefaultTenantId()).resolves.toEqual(id);
    delete process.env.WEBHOOK_TENANT_ID;
  });

  it('runWithDefaultWebhookTenant sets AsyncLocalStorage tenantId', async () => {
    const id = new mongoose.Types.ObjectId();
    process.env.WEBHOOK_TENANT_ID = String(id);
    await runWithDefaultWebhookTenant(async () => {
      expect(String(getTenantId())).toBe(String(id));
    });
    delete process.env.WEBHOOK_TENANT_ID;
  });
});
