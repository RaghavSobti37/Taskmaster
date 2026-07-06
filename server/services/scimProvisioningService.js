const crypto = require('crypto');
const User = require('../models/User');
const TenantMembership = require('../models/TenantMembership');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const scimOpts = () => bypassOptions('SCIM_PROVISION');

async function listActiveMembershipUsers(tenantId) {
  return TenantMembership.find({ tenantId, status: 'active' })
    .setOptions(scimOpts())
    .populate('userId', 'email name suspended');
}

async function findUserByEmail(email) {
  return User.findOne({ email }).setOptions(scimOpts());
}

async function createScimUser({ email, name }) {
  return User.create({
    name: name || email.split('@')[0],
    email,
    password: crypto.randomBytes(16).toString('hex'),
  });
}

async function upsertMembership(tenantId, userId, { role, status }) {
  return TenantMembership.findOneAndUpdate(
    { tenantId, userId },
    { role, status },
    { upsert: true, new: true },
  ).setOptions(scimOpts());
}

async function findMembership(tenantId, userId) {
  return TenantMembership.findOne({ tenantId, userId }).setOptions(scimOpts());
}

module.exports = {
  listActiveMembershipUsers,
  findUserByEmail,
  createScimUser,
  upsertMembership,
  findMembership,
};
