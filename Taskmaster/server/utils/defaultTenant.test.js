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

  it('resolveDefaultTenantId uses PLATFORM_TENANT_SLUG in production', async () => {
    const Tenant = require('../models/Tenant');
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.WEBHOOK_TENANT_ID;
    delete process.env.DEFAULT_TENANT_ID;

    const tenant = await Tenant.create({
      name: 'TSC Platform',
      slug: 'tsc-webhook-test',
      contactEmail: 'webhook@test.com',
      status: 'active',
    });
    process.env.PLATFORM_TENANT_SLUG = 'tsc-webhook-test';

    await expect(resolveDefaultTenantId()).resolves.toEqual(tenant._id);

    delete process.env.PLATFORM_TENANT_SLUG;
    process.env.NODE_ENV = prev;
    await Tenant.deleteOne({ _id: tenant._id });
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
