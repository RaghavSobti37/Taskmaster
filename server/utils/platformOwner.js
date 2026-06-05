const User = require('../models/User');
const { getPlatformOwnerUserId } = require('../../shared/platformUserIds');

/** Fallback emails when PLATFORM_OWNER_USER_ID / PlatformSettings is unset. */
const PLATFORM_OWNER_EMAIL_FALLBACKS = [
  process.env.PLATFORM_OWNER_EMAIL,
  process.env.ADMIN_EMAIL,
  'REDACTED_ADMIN@example.com',
].filter(Boolean);

/**
 * Resolve platform owner user from PlatformSettings, env, then email fallbacks.
 * @returns {Promise<{ _id: import('mongoose').Types.ObjectId, email?: string, name?: string } | null>}
 */
async function resolvePlatformOwnerUser({ session, select = '_id email name' } = {}) {
  const id = getPlatformOwnerUserId();
  if (id) {
    let q = User.findById(id).select(select);
    if (session) q = q.session(session);
    const user = await q.lean();
    if (user) return user;
  }

  for (const email of PLATFORM_OWNER_EMAIL_FALLBACKS) {
    let q = User.findOne({ email }).select(select);
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
