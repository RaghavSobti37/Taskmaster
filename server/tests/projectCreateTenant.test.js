const mongoose = require('mongoose');
const Project = require('../models/Project');
const { formatProjectName } = require('../utils/formatProjectName');
const { resolveTenantIdForRequest } = require('../utils/tenantContext');

describe('project create tenant resolution', () => {
  const prevEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it('resolveTenantIdForRequest prefers req.user.tenantId when ALS is empty', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const resolved = await resolveTenantIdForRequest({
      user: { tenantId },
    });
    expect(String(resolved)).toBe(String(tenantId));
  });

  it('Project.create succeeds in production when tenantId is set explicitly', async () => {
    process.env.NODE_ENV = 'production';
    const tenantId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    const project = await Project.create({
      name: formatProjectName(`Tenant Explicit ${Date.now()}`),
      workspace: 'GENERAL',
      outletId: 'main',
      owner: ownerId,
      members: [ownerId],
      memberRoles: [{ user: ownerId, role: 'admin' }],
      tenantId,
    });

    expect(project.tenantId.toString()).toBe(tenantId.toString());
    await Project.deleteOne({ _id: project._id });
  });
});
