const User = require('../models/User');
const { getPlatformOwnerUserId } = require('../../shared/platformUserIds');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const TENANT_SAFE_LOOKUP = bypassOptions('platform_owner_resolve');

/** Fallback emails when PLATFORM_OWNER_USER_ID / PlatformSettings is unset. */
const PLATFORM_OWNER_EMAIL_FALLBACKS = [
  process.env.PLATFORM_OWNER_EMAIL,
  process.env.ADMIN_EMAIL,
  'REDACTED_ADMIN@example.com',
].filter(Boolean);

async function refreshPlatformOwnerRuntime() {
  try {
    const { loadPlatformSettings } = require('../services/platformSettingsService');
    await loadPlatformSettings();
  } catch {
    /* settings optional during bootstrap */
  }
}

/**
 * Resolve platform owner user from PlatformSettings, env, then email fallbacks.
 * @returns {Promise<{ _id: import('mongoose').Types.ObjectId, email?: string, name?: string } | null>}
 */
async function resolvePlatformOwnerUser({ session, select = '_id email name' } = {}) {
  await refreshPlatformOwnerRuntime();

  const id = getPlatformOwnerUserId();
  if (id) {
    let q = User.findById(id).select(select).setOptions(TENANT_SAFE_LOOKUP);
    if (session) q = q.session(session);
    const user = await q.lean();
    if (user) return user;
  }

  for (const email of PLATFORM_OWNER_EMAIL_FALLBACKS) {
    let q = User.findOne({ email }).select(select).setOptions(TENANT_SAFE_LOOKUP);
    if (session) q = q.session(session);
    const user = await q.lean();
    if (user) return user;
  }

  return null;
}

module.exports = {
  resolvePlatformOwnerUser,
  getPlatformOwnerUserId,
  PLATFORM_OWNER_EMAIL_FALLBACKS,
};
