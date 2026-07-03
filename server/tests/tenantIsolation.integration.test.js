const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function loginOpsUser(stamp) {
  let dept = await Department.findOne({ slug: 'ops' });
  if (!dept) {
    dept = await Department.create({
      name: 'Operations',
      slug: 'ops',
      permissionPreset: 'ops',
      pagePermissions: PRESET_PAGES.ops,
    });
  }

  const email = `tenant-iso-${stamp}@coreknot-test.local`;
  await User.deleteOne({ email });
  const user = await User.create({
    name: 'Tenant ISO Ops',
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
    tenantId: new mongoose.Types.ObjectId(),
  });

  const agent = request.agent(app);
  await mintSessionAgent(agent, user._id);
  return { agent, user };
}

describe('tenant isolation (required CI gate)', () => {
  const stamp = Date.now();

  it('finance approve rejects cross-tenant spoof payload', async () => {
    const { agent, user } = await loginOpsUser(stamp);
    const otherTenant = new mongoose.Types.ObjectId();

    const project = await Project.create({
      name: `Tenant ISO ${stamp}`,
      outletId: 'test-outlet',
      owner: user._id,
      status: 'active',
      tenantId: user.tenantId,
    });

    const doc = await FinanceDocument.create({
      title: 'ISO doc',
      project: project._id,
      tenantId: user.tenantId,
      uploadedBy: user._id,
      fileUrl: 'https://example.com/iso.pdf',
      fileName: 'iso.pdf',
      fileType: 'application/pdf',
      category: 'invoice',
      approvalStatus: 'pending',
    });

    const res = await agent
      .patch(`/api/finance/${doc._id}/approve`)
      .send({ tenantId: String(otherTenant) });

    expect(res.statusCode).toBe(403);

    await FinanceDocument.deleteOne({ _id: doc._id });
    await Project.deleteOne({ _id: project._id });
  });
});
