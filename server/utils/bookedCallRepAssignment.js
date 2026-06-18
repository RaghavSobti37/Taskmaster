const Department = require('../models/Department');
const User = require('../models/User');
const mongoose = require('mongoose');
const { SALES_SLUG } = require('./departmentPermissions');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const logger = require('./logger');

/** Website book-a-call → Satyam only (sales). */
const SATYAM_REP_SPEC = { repId: 'sr06', patterns: [/satyam/i] };
const BYPASS = bypassOptions('booked-call-rep-lookup');

/**
 * Resolve Satyam User _id from sales department.
 */
async function resolveSatyamSalesRepId() {
  const { getBookedCallSalesRepUserId } = require('../../shared/platformUserIds');
  const { loadPlatformSettings } = require('../services/platformSettingsService');
  await loadPlatformSettings();
  const settingsId = getBookedCallSalesRepUserId();
  if (settingsId && mongoose.Types.ObjectId.isValid(settingsId)) {
    return new mongoose.Types.ObjectId(settingsId);
  }

  const envId = (process.env.BOOKED_CALL_SALES_REP_ID || process.env.SATYAM_SALES_REP_ID || '').trim();
  if (envId && mongoose.Types.ObjectId.isValid(envId)) {
    return new mongoose.Types.ObjectId(envId);
  }

  const salesDept = await Department.findOne({ slug: SALES_SLUG }).setOptions(BYPASS);
  const query = salesDept ? { departmentId: salesDept._id } : {};
  const salesUsers = await User.find(query).select('_id name email repId').setOptions(BYPASS).lean();

  let user = salesUsers.find((u) => u.repId === SATYAM_REP_SPEC.repId);
  if (!user) {
    user = salesUsers.find((u) =>
      SATYAM_REP_SPEC.patterns.some((p) => p.test(u.name || '') || p.test(u.email || ''))
    );
  }
  if (!user && salesUsers.length === 1) {
    user = salesUsers[0];
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
