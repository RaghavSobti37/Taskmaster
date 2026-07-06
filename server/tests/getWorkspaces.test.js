const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const { getWorkspaces } = require('../domains/projects/controllers/projectController');
const { runWithContext } = require('../utils/tenantContext');
const { ADMIN_SLUG } = require('../utils/departmentPermissions');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getWorkspaces', () => {
  it('returns legacy workspaces without tenantId when tenant context is set', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const legacyName = `LEGACY-WS-${suffix}`;

    const tenant = await Tenant.create({
      name: `Legacy WS Tenant ${suffix}`,
      contactEmail: `legacy-ws-${suffix}@test.com`,
    });
    const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
    const user = await User.create({
      name: 'Legacy WS User',
      email: `legacy-ws-user-${suffix}@test.com`,
      tenantId: tenant._id,
      departmentId: adminDept?._id,
    });

    await Workspace.collection.insertOne({
      name: legacyName.toUpperCase(),
      color: '#64748b',
      order: 0,
      createdBy: user._id,
      createdAt: new Date(),
    });

    const req = { user };
    const res = mockRes();

    await runWithContext({ tenantId: tenant._id, userId: user._id.toString() }, () =>
      getWorkspaces(req, res)
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.some((w) => w.name === legacyName.toUpperCase())).toBe(true);
  });
});
