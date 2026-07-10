const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantUsage = require('../models/TenantUsage');
const { getPlanLimits } = require('../../shared/planLimits.cjs');
const { isUnlockAllMode } = require('./tenantUnlockService');

function currentPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function getTenantUsage(tenantId) {
  const periodKey = currentPeriodKey();
  let usage = await TenantUsage.findOne({ tenantId, periodKey }).setOptions({ bypassTenant: true });
  if (!usage) {
    usage = await TenantUsage.create({ tenantId, periodKey });
  }
  return usage;
}

async function incrementUsage(tenantId, field, amount = 1) {
  const periodKey = currentPeriodKey();
  await TenantUsage.findOneAndUpdate(
    { tenantId, periodKey },
    { $inc: { [field]: amount } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function getPlanSnapshot(tenantId) {
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true }).select('plan');
  const plan = tenant?.plan || 'free';
  const limits = getPlanLimits(plan);
  const seatsUsed = await TenantMembership.countDocuments({ tenantId, status: 'active' }).setOptions({ bypassTenant: true });
  const usage = await getTenantUsage(tenantId);
  return {
    plan,
    limits,
    seatsUsed,
    usage: {
      emailSends: usage.emailSends,
      storageMb: usage.storageMb,
      apiCalls: usage.apiCalls,
    },
  };
}

async function assertSeatAvailable(tenantId) {
  const snap = await getPlanSnapshot(tenantId);
  if (isUnlockAllMode()) return snap;
  if (snap.seatsUsed >= snap.limits.seats) {
    const err = new Error('Seat limit reached for current plan');
    err.code = 'SEAT_LIMIT';
    err.status = 402;
    throw err;
  }
  return snap;
}

module.exports = {
  currentPeriodKey,
  getTenantUsage,
  incrementUsage,
  getPlanSnapshot,
  assertSeatAvailable,
};
