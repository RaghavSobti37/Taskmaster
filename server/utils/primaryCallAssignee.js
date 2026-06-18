const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const { ARTIST_SLUG, SALES_SLUG } = require('./departmentPermissions');

const DEFAULT_CALL_ASSIGNEE = /akash/i;

function namePatternsFromEnv() {
  const raw = process.env.PRIMARY_CALL_ASSIGNEE_NAME || 'akash';
  return raw.split(',').map((part) => part.trim()).filter(Boolean).map((part) => new RegExp(part, 'i'));
}

async function findUserByPatterns(patterns, deptSlug = null) {
  const query = {};
  if (deptSlug) {
    const dept = await Department.findOne({ slug: deptSlug }).setOptions({ bypassTenant: true });
    if (dept) query.departmentId = dept._id;
  }
  const users = await User.find(query).select('_id name email').setOptions({ bypassTenant: true }).lean();
  return users.find((u) =>
    patterns.some((p) => p.test(u.name || '') || p.test(u.email || ''))
  ) || null;
}

/**
 * Primary outbound-call assignee (artist bookings + TSC book-a-call).
 * Defaults to Akash in artist-management, then sales.
 */
async function resolvePrimaryCallAssigneeId() {
  const { getPrimaryCallAssigneeUserId } = require('../../shared/platformUserIds');
  const { loadPlatformSettings } = require('../services/platformSettingsService');
  await loadPlatformSettings();
  const settingsId = getPrimaryCallAssigneeUserId();
  if (settingsId && mongoose.Types.ObjectId.isValid(settingsId)) {
    return new mongoose.Types.ObjectId(settingsId);
  }

  const envId = process.env.PRIMARY_CALL_ASSIGNEE_ID;
  if (envId && mongoose.Types.ObjectId.isValid(envId)) {
    return new mongoose.Types.ObjectId(envId);
  }

  const patterns = namePatternsFromEnv();
  const artist = await findUserByPatterns(patterns, ARTIST_SLUG);
  if (artist?._id) return artist._id;

  const sales = await findUserByPatterns(patterns, SALES_SLUG);
  if (sales?._id) return sales._id;

  const any = await findUserByPatterns(patterns);
  return any?._id || null;
}

module.exports = {
  DEFAULT_CALL_ASSIGNEE,
  resolvePrimaryCallAssigneeId,
  findUserByPatterns,
};
