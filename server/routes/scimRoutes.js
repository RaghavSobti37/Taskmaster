const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const TenantMembership = require('../models/TenantMembership');
const { recordAuditEvent } = require('../services/auditEventService');
const { scimAuth } = require('../middleware/scimAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.use(scimAuth);

router.get('/Users', asyncHandler(async (req, res) => {
  const memberships = await TenantMembership.find({ tenantId: req.tenantId, status: 'active' })
    .setOptions({ bypassTenant: true })
    .populate('userId', 'email name suspended');
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

  let user = await User.findOne({ email }).setOptions({ bypassTenant: true });
  if (!user) {
    user = await User.create({
      name: name?.formatted || email.split('@')[0],
      email,
      password: crypto.randomBytes(16).toString('hex'),
    });
  }

  const jitRole = req.scimTenant?.sso?.jitDefaultRole || 'member';
  const membershipRole = jitRole === 'standard' ? 'member' : jitRole;
  await TenantMembership.findOneAndUpdate(
    { tenantId: req.tenantId, userId: user._id },
    { role: membershipRole, status: active === false ? 'suspended' : 'active' },
    { upsert: true, new: true },
  ).setOptions({ bypassTenant: true });

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
  const membership = await TenantMembership.findOne({
    tenantId: req.tenantId,
    userId,
  }).setOptions({ bypassTenant: true });
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
  const membership = await TenantMembership.findOne({
    tenantId: req.tenantId,
    userId,
  }).setOptions({ bypassTenant: true });
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
