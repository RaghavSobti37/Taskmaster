const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { runWithContext } = require('../utils/tenantContext');
const Tenant = require('../models/Tenant');

describe('tenantPlugin validate hook', () => {
  let TestModel;

  beforeAll(() => {
    const schema = new mongoose.Schema({ name: String });
    schema.plugin(tenantPlugin);
    TestModel = mongoose.model('TenantPluginTestDoc', schema);
  });

  afterAll(async () => {
    await mongoose.deleteModel('TenantPluginTestDoc');
  });

  it('uses AsyncLocalStorage tenantId when document has none', async () => {
    const tenant = await Tenant.create({ name: 'Ctx Tenant', contactEmail: 'ctx@test.com' });
    const doc = await runWithContext({ tenantId: tenant._id }, () =>
      TestModel.create({ name: 'scoped' }),
    );
    expect(String(doc.tenantId)).toBe(String(tenant._id));
  });

  it('falls back to Default Tenant in non-production without context', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const doc = await TestModel.create({ name: 'fallback' });
      const defaultTenant = await Tenant.findOne({ name: 'Default Tenant' });
      expect(defaultTenant).toBeTruthy();
      expect(String(doc.tenantId)).toBe(String(defaultTenant._id));
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('fails in production when tenant context is missing', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(TestModel.create({ name: 'no-ctx' })).rejects.toThrow(
        /tenantId required/i,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
