const Tenant = require('../models/Tenant');
const User = require('../models/User');
const DashboardPreset = require('../models/DashboardPreset');
const ShortcutPreference = require('../models/ShortcutPreference');
const customizationController = require('../controllers/customizationController');
const { runWithContext } = require('../utils/tenantContext');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const callWithTenant = (tenantId, user, handler, req = {}) => {
  const res = mockRes();
  const next = jest.fn((err) => {
    if (err) throw err;
  });
  return runWithContext({ tenantId, userId: String(user._id) }, async () => {
    await handler({ user, tenantId, ...req }, res, next);
    return { res, next };
  });
};

describe('customization tenant scope', () => {
  it('keeps dashboard presets separate for the same user in different orgs', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tenantA = await Tenant.create({ name: `Dash A ${suffix}`, contactEmail: `dash-a-${suffix}@test.com` });
    const tenantB = await Tenant.create({ name: `Dash B ${suffix}`, contactEmail: `dash-b-${suffix}@test.com` });
    const user = await User.create({
      name: 'Dashboard Scoped User',
      email: `dash-scope-${suffix}@test.com`,
      tenantId: tenantA._id,
    });

    await callWithTenant(tenantA._id, user, customizationController.loadDepartmentPreset, {
      params: { department: 'sales' },
    });
    await callWithTenant(tenantB._id, user, customizationController.loadDepartmentPreset, {
      params: { department: 'hr' },
    });

    const presets = await DashboardPreset.find({ userId: user._id }).setOptions({ bypassTenant: true }).lean();
    expect(presets).toHaveLength(2);
    expect(presets.find((p) => String(p.tenantId) === String(tenantA._id)).department).toBe('sales');
    expect(presets.find((p) => String(p.tenantId) === String(tenantB._id)).department).toBe('hr');
  });

  it('keeps shortcut overrides separate for the same user in different orgs', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tenantA = await Tenant.create({ name: `Short A ${suffix}`, contactEmail: `short-a-${suffix}@test.com` });
    const tenantB = await Tenant.create({ name: `Short B ${suffix}`, contactEmail: `short-b-${suffix}@test.com` });
    const user = await User.create({
      name: 'Shortcut Scoped User',
      email: `shortcut-scope-${suffix}@test.com`,
      tenantId: tenantA._id,
    });

    await callWithTenant(tenantA._id, user, customizationController.saveShortcutPreferences, {
      body: { bindings: { palette: { keys: ['mod', 'j'] } } },
    });
    await callWithTenant(tenantB._id, user, customizationController.saveShortcutPreferences, {
      body: { bindings: { palette: { keys: ['mod', 'u'] } } },
    });

    const shortcuts = await ShortcutPreference.find({ userId: user._id }).setOptions({ bypassTenant: true }).lean();
    expect(shortcuts).toHaveLength(2);
    expect(shortcuts.find((p) => String(p.tenantId) === String(tenantA._id)).bindings.palette.keys).toEqual(['mod', 'j']);
    expect(shortcuts.find((p) => String(p.tenantId) === String(tenantB._id)).bindings.palette.keys).toEqual(['mod', 'u']);
  });
});
