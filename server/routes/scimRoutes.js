const express = require('express');
const { recordAuditEvent } = require('../services/auditEventService');
const { scimAuth } = require('../middleware/scimAuth');
const asyncHandler = require('../middleware/asyncHandler');
const {
  listActiveMembershipUsers,
  findUserByEmail,
  createScimUser,
  upsertMembership,
  findMembership,
} = require('../services/scimProvisioningService');

const router = express.Router();

router.use(scimAuth);

router.get('/Users', asyncHandler(async (req, res) => {
  const memberships = await listActiveMembershipUsers(req.tenantId);
  const resources = memberships
    .filter((m) => m.userId && !m.userId.suspended)
    .map((m) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: String(m.userId._id),
      userName: m.userId.email,
      active: true,
      emails: [{ value: m.userId.email, primary: true }],
      name: { formatted: m.userId.name },
    }));
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: resources.length,
    Resources: resources,
  });
}));

router.post('/Users', asyncHandler(async (req, res) => {
  const { userName, emails, name, active } = req.body || {};
  const email = String(emails?.[0]?.value || userName || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'userName or emails[0].value required',
      status: '400',
    });
  }

  let user = await findUserByEmail(email);
  if (!user) {
    user = await createScimUser({
      email,
      name: name?.formatted,
    });
  }

  const jitRole = req.scimTenant?.sso?.jitDefaultRole || 'member';
  const membershipRole = jitRole === 'standard' ? 'member' : jitRole;
  await upsertMembership(req.tenantId, user._id, {
    role: membershipRole,
    status: active === false ? 'suspended' : 'active',
  });

  await recordAuditEvent({
    tenantId: req.tenantId,
    action: 'scim.user.provision',
    resourceType: 'user',
    resourceId: user._id,
    after: { email, active: active !== false },
    req,
  });

  res.status(201).json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: String(user._id),
    userName: email,
    active: active !== false,
    emails: [{ value: email, primary: true }],
    name: { formatted: user.name },
  });
}));

router.patch('/Users/:id', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const membership = await findMembership(req.tenantId, userId);
  if (!membership) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User not found',
      status: '404',
    });
  }
  if (req.body?.active === false) membership.status = 'suspended';
  if (req.body?.active === true) membership.status = 'active';
  await membership.save();
  await recordAuditEvent({
    tenantId: req.tenantId,
    action: 'scim.user.updated',
    resourceType: 'user',
    resourceId: userId,
    after: { active: req.body?.active },
    req,
  });
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: String(userId),
    active: membership.status === 'active',
  });
}));

router.delete('/Users/:id', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const membership = await findMembership(req.tenantId, userId);
  if (!membership) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User not found',
      status: '404',
    });
  }
  membership.status = 'suspended';
  await membership.save();
  await recordAuditEvent({
    tenantId: req.tenantId,
    action: 'scim.user.deprovision',
    resourceType: 'user',
    resourceId: userId,
    req,
  });
  res.status(204).send();
}));

module.exports = router;
