const Department = require('../models/Department');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { SALES_SLUG } = require('./departmentPermissions');
const { BOOKED_CALL_SOURCE_RE } = require('../../shared/dataInlets');
const { resolvePrimaryCallAssigneeId } = require('./primaryCallAssignee');
const logger = require('./logger');

/** Satyam : Aryaman : Akash = 2 : 1 : 1 */
const BOOKED_CALL_REP_WEIGHTS = [2, 1, 1];

const BOOKED_CALL_REP_SPECS = [
  { repId: 'sr06', patterns: [/satyam/i] },
  { repId: 'sr09', patterns: [/aryaman/i] },
  { patterns: [/akash/i] },
];

function pickByWeightedQuota(repIds, counts) {
  let bestIdx = 0;
  let bestScore = Infinity;
  for (let i = 0; i < repIds.length; i += 1) {
    const score = (counts[i] || 0) / BOOKED_CALL_REP_WEIGHTS[i];
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return repIds[bestIdx];
}

/**
 * Resolve [Satyam, Aryaman, Akash] User _ids from sales department.
 */
async function resolveBookedCallRepIds() {
  const salesDept = await Department.findOne({ slug: SALES_SLUG });
  const query = salesDept ? { departmentId: salesDept._id } : {};
  const salesUsers = await User.find(query).select('_id name email repId').lean();

  const repIds = [];
  for (const spec of BOOKED_CALL_REP_SPECS) {
    let user = spec.repId ? salesUsers.find((u) => u.repId === spec.repId) : null;
    if (!user) {
      user = salesUsers.find((u) =>
        spec.patterns.some((p) => p.test(u.name || '') || p.test(u.email || ''))
      );
    }
    if (user) repIds.push(user._id);
  }
  return repIds;
}

/**
 * In-memory assigner for a single sync batch (2 Satyam : 1 Aryaman : 1 Akash per 4 leads).
 */
function createBookedCallRepAssigner(repIds) {
  const counts = repIds.map(() => 0);
  return () => {
    const id = pickByWeightedQuota(repIds, counts);
    const idx = repIds.findIndex((rid) => String(rid) === String(id));
    if (idx >= 0) counts[idx] += 1;
    return id;
  };
}

/**
 * Pick next rep using live CRM counts for booked-call sources (webhooks / single inserts).
 */
async function assignNextBookedCallRep() {
  const primaryId = await resolvePrimaryCallAssigneeId();
  if (primaryId) return primaryId;

  const repIds = await resolveBookedCallRepIds();
  if (repIds.length < 3) {
    logger.warn('bookedCallRepAssignment', `Expected 3 reps, found ${repIds.length}`);
    return repIds[0] || null;
  }

  const counts = await Promise.all(
    repIds.map((repId) =>
      Lead.countDocuments({
        assignedRepId: repId,
        leadStatus: { $ne: 'Converted' },
        source: { $regex: BOOKED_CALL_SOURCE_RE.source, $options: 'i' },
      })
    )
  );

  return pickByWeightedQuota(repIds, counts);
}

module.exports = {
  BOOKED_CALL_REP_WEIGHTS,
  resolveBookedCallRepIds,
  createBookedCallRepAssigner,
  assignNextBookedCallRep,
};
