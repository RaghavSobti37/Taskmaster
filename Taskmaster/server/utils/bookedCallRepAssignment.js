const Department = require('../models/Department');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const { SALES_SLUG } = require('./departmentPermissions');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { isE2eTestUser } = require('./e2eTestUsers');
const { pickNextRepFromList, createBookedCallRepAssigner } = require('./bookedCallRepRoundRobin');
const logger = require('./logger');

const BYPASS = bypassOptions('booked-call-rep-lookup');
const REDIS_ROUND_ROBIN_KEY = 'booked-call:round-robin';
const SETTINGS_SINGLETON_KEY = 'global';

function isBookCallEligibleSalesRep(user) {
  if (!user?._id) return false;
  if (isE2eTestUser(user.email)) return false;
  if (/^e2e/i.test(String(user.name || ''))) return false;
  if (/^e2e/i.test(String(user.repId || ''))) return false;
  return true;
}

/** Active sales department users eligible for website book-a-call rotation. */
async function listSalesDepartmentReps() {
  const salesDept = await Department.findOne({ slug: SALES_SLUG }).setOptions(BYPASS);
  if (!salesDept) return [];

  const users = await User.find({ departmentId: salesDept._id })
    .select('_id name email phone repId')
    .sort({ repId: 1, name: 1, _id: 1 })
    .setOptions(BYPASS)
    .lean();

  return users.filter(isBookCallEligibleSalesRep);
}

async function incrementBookedCallRoundRobinCounter() {
  const doc = await PlatformSettings.findOneAndUpdate(
    { singletonKey: SETTINGS_SINGLETON_KEY },
    { $inc: { bookedCallRoundRobinCounter: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).setOptions(BYPASS);

  return doc?.bookedCallRoundRobinCounter || 1;
}

/**
 * Next sales rep for website book-a-call (round-robin across sales department).
 */
async function assignNextBookedCallRep() {
  const reps = await listSalesDepartmentReps();
  if (!reps.length) {
    logger.warn('bookedCallRepAssignment', 'No eligible users in sales department');
    return null;
  }

  if (reps.length === 1) {
    logger.info('bookedCallRepAssignment', 'Single sales rep pool', {
      repId: String(reps[0]._id),
      repName: reps[0].name,
    });
    return reps[0]._id;
  }

  let counter = null;
  let source = 'mongo';

  const { getSharedRedis } = require('./sharedRedis');
  const redis = getSharedRedis();
  if (redis?.status === 'ready') {
    try {
      counter = await redis.incr(REDIS_ROUND_ROBIN_KEY);
      source = 'redis';
    } catch (err) {
      logger.warn('bookedCallRepAssignment', 'Redis round-robin fallback to Mongo counter', {
        error: err.message,
      });
    }
  }

  if (counter == null) {
    counter = await incrementBookedCallRoundRobinCounter();
  }

  const idx = (counter - 1) % reps.length;
  const chosen = reps[idx];
  logger.info('bookedCallRepAssignment', 'Round-robin assign', {
    repId: String(chosen._id),
    repName: chosen.name,
    index: idx,
    poolSize: reps.length,
    counter,
    source,
  });
  return chosen._id;
}

/** WhatsApp destination from the assigned rep's User.phone only. */
async function resolveBookedCallRepPhone(repId) {
  if (!repId) return null;

  const rep = await User.findById(repId).select('phone name').setOptions(BYPASS).lean();
  const phone = String(rep?.phone || '').trim();
  if (!phone) {
    logger.warn('bookedCallRepAssignment', 'Sales rep has no phone — WhatsApp alert skipped', {
      repId: String(repId),
      repName: rep?.name,
    });
    return null;
  }
  return phone;
}

async function resolveBookedCallRepIds() {
  const reps = await listSalesDepartmentReps();
  return reps.map((r) => r._id);
}

/** @deprecated Use resolveBookedCallRepIds — first sales rep only */
async function resolveSatyamSalesRepId() {
  const ids = await resolveBookedCallRepIds();
  return ids[0] || null;
}

module.exports = {
  isBookCallEligibleSalesRep,
  listSalesDepartmentReps,
  pickNextRepFromList,
  assignNextBookedCallRep,
  resolveBookedCallRepPhone,
  resolveBookedCallRepIds,
  resolveSatyamSalesRepId,
  createBookedCallRepAssigner,
};
