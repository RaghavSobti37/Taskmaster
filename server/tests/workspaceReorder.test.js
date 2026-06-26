const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Workspace = require('../models/Workspace');
const WorkspacePreference = require('../models/WorkspacePreference');
const { reorderWorkspaces } = require('../domains/projects/controllers/projectController');
const { runWithContext } = require('../utils/tenantContext');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('reorderWorkspaces', () => {
  let tenant;
  let user;
  let wsA;
  let wsB;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    wsA = `GENERAL-${suffix}`;
    wsB = `TSC-TECH-${suffix}`;

    tenant = await Tenant.create({ name: `Reorder Tenant ${suffix}`, contactEmail: `reorder-${suffix}@test.com` });
    user = await User.create({
      name: 'Reorder User',
      email: `reorder-ws-${suffix}@test.com`,
      tenantId: tenant._id,
    });

    await Workspace.create({ name: wsA, color: '#64748b', order: 0, createdBy: user._id, tenantId: tenant._id });
    await Workspace.create({ name: wsB, color: '#2ecc71', order: 1, createdBy: user._id, tenantId: tenant._id });
  });

  it('backfills tenantId on legacy preference rows', async () => {
    await WorkspacePreference.collection.insertOne({
      userId: user._id,
      order: [wsA, wsB],
      updatedAt: new Date(),
    });

    const req = { user, body: { order: [wsB, wsA] } };
    const res = mockRes();

    await runWithContext({ tenantId: tenant._id, userId: user._id.toString() }, () =>
      reorderWorkspaces(req, res)
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();

    const prefs = await WorkspacePreference.find({ userId: user._id }).setOptions({ bypassTenant: true });
    expect(prefs).toHaveLength(1);
    expect(String(prefs[0].tenantId)).toBe(String(tenant._id));
    expect(prefs[0].order).toEqual([wsB.toUpperCase(), wsA.toUpperCase()]);
  });

  it('creates a tenant-scoped preference when none exists', async () => {
    const req = { user, body: { order: [wsB, wsA] } };
    const res = mockRes();

    await runWithContext({ tenantId: tenant._id, userId: user._id.toString() }, () =>
      reorderWorkspaces(req, res)
    );

    expect(res.status).not.toHaveBeenCalled();
    const prefs = await WorkspacePreference.find({ userId: user._id }).setOptions({ bypassTenant: true });
    expect(prefs).toHaveLength(1);
    expect(String(prefs[0].tenantId)).toBe(String(tenant._id));
    expect(prefs[0].order).toEqual([wsB.toUpperCase(), wsA.toUpperCase()]);
  });
});
