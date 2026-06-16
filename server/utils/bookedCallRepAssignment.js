const Department = require('../models/Department');
const User = require('../models/User');
const { SALES_SLUG } = require('./departmentPermissions');
const logger = require('./logger');

/** Website book-a-call → Satyam only (sales). */
const SATYAM_REP_SPEC = { repId: 'sr06', patterns: [/satyam/i] };

/**
 * Resolve Satyam User _id from sales department.
 */
async function resolveSatyamSalesRepId() {
  const salesDept = await Department.findOne({ slug: SALES_SLUG });
  const query = salesDept ? { departmentId: salesDept._id } : {};
  const salesUsers = await User.find(query).select('_id name email repId').lean();

  let user = salesUsers.find((u) => u.repId === SATYAM_REP_SPEC.repId);
  if (!user) {
    user = salesUsers.find((u) =>
      SATYAM_REP_SPEC.patterns.some((p) => p.test(u.name || '') || p.test(u.email || ''))
    );
  }
  return user?._id || null;
}

/**
 * Pick rep for website book-a-call — always Satyam in sales.
 */
async function assignNextBookedCallRep() {
  const satyamId = await resolveSatyamSalesRepId();
  if (!satyamId) {
    logger.warn('bookedCallRepAssignment', 'Satyam not found in sales department');
  }
  return satyamId;
}

/** @deprecated Use resolveSatyamSalesRepId — kept for importers that referenced rep list */
async function resolveBookedCallRepIds() {
  const id = await resolveSatyamSalesRepId();
  return id ? [id] : [];
}

function createBookedCallRepAssigner(repIds) {
  const id = repIds?.[0] || null;
  return () => id;
}

module.exports = {
  SATYAM_REP_SPEC,
  resolveSatyamSalesRepId,
  resolveBookedCallRepIds,
  createBookedCallRepAssigner,
  assignNextBookedCallRep,
};
