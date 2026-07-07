const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { runWithContext } = require('../utils/tenantContext');
const Tenant = require('../models/Tenant');
const { ORG_FEATURE_KEYS } = require('../../shared/orgFeatures.cjs');

describe('tenantPlugin validate hook', () => {
  let TestModel;

  beforeAll(() => {
    if (mongoose.models.TenantPluginTestDoc) {
      mongoose.deleteModel('TenantPluginTestDoc');
    }
    const schema = new mongoose.Schema({ name: String, category: String });
    schema.plugin(tenantPlugin);
    TestModel = mongoose.model('TenantPluginTestDoc', schema);
  });

  afterEach(async () => {
    await TestModel.deleteMany({}).setOptions({ bypassTenant: true });
  });

  afterAll(async () => {
    if (mongoose.models.TenantPluginTestDoc) {
      await mongoose.deleteModel('TenantPluginTestDoc');
    }
  });

  it('uses AsyncLocalStorage tenantId when document has none', async () => {
    const tenant = await Tenant.create({ name: 'Ctx Tenant', contactEmail: 'ctx@test.com' });
    const doc = await runWithContext({ tenantId: tenant._id }, () =>
      TestModel.create({ name: 'scoped' }),
    );
    expect(String(doc.tenantId)).toBe(String(tenant._id));
  });

  it('falls back to Default Tenant in test without context', async () => {
    const prev = process.env.NODE_ENV;
    const prevFallback = process.env.ALLOW_DEFAULT_TENANT_FALLBACK;
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_DEFAULT_TENANT_FALLBACK = 'true';
    try {
      const doc = await TestModel.create({ name: 'fallback' });
      const defaultTenant = await Tenant.findOne({ name: 'Default Tenant' });
      expect(defaultTenant).toBeTruthy();
      expect(String(doc.tenantId)).toBe(String(defaultTenant._id));
      for (const key of ORG_FEATURE_KEYS) {
        expect(defaultTenant.featureUnlocks[key]).toBe(true);
      }
    } finally {
      process.env.NODE_ENV = prev;
      process.env.ALLOW_DEFAULT_TENANT_FALLBACK = prevFallback;
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

  it('scopes aggregate() to tenant context', async () => {
    const tenantA = await Tenant.create({ name: 'Agg A', contactEmail: 'a@test.com' });
    const tenantB = await Tenant.create({ name: 'Agg B', contactEmail: 'b@test.com' });

    await TestModel.create([
      { name: 'a1', category: 'x', tenantId: tenantA._id },
      { name: 'a2', category: 'x', tenantId: tenantA._id },
      { name: 'b1', category: 'x', tenantId: tenantB._id },
    ]);

    const rows = await runWithContext({ tenantId: tenantA._id }, async () =>
      TestModel.aggregate([
        { $match: { category: 'x' } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
    );

    expect(rows[0]?.count).toBe(2);
  });

  it('scopes distinct() to tenant context', async () => {
    const tenantA = await Tenant.create({ name: 'Dist A', contactEmail: 'da@test.com' });
    const tenantB = await Tenant.create({ name: 'Dist B', contactEmail: 'db@test.com' });

    await TestModel.create([
      { name: 'one', category: 'alpha', tenantId: tenantA._id },
      { name: 'two', category: 'beta', tenantId: tenantA._id },
      { name: 'three', category: 'gamma', tenantId: tenantB._id },
    ]);

    const categories = await runWithContext({ tenantId: tenantA._id }, async () =>
      TestModel.distinct('category'),
    );

    expect(categories.sort()).toEqual(['alpha', 'beta']);
  });

  it('honors bypassTenant on aggregate()', async () => {
    const tenantA = await Tenant.create({ name: 'Bypass A', contactEmail: 'ba@test.com' });
    const tenantB = await Tenant.create({ name: 'Bypass B', contactEmail: 'bb@test.com' });

    await TestModel.create([
      { name: 'x', tenantId: tenantA._id },
      { name: 'y', tenantId: tenantB._id },
    ]);

    const rows = await TestModel.aggregate([{ $count: 'count' }]).option({ bypassTenant: true });
    expect(rows[0]?.count).toBe(2);
  });
});
