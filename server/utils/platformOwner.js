const User = require('../models/User');
const { getPlatformOwnerUserId } = require('../../shared/platformUserIds');

/**
 * Resolve platform owner user from PLATFORM_OWNER_USER_ID env.
 * @returns {Promise<{ _id: import('mongoose').Types.ObjectId } | null>}
 */
async function resolvePlatformOwnerUser({ session, select = '_id' } = {}) {
  const id = getPlatformOwnerUserId();
  if (!id) return null;
  let q = User.findById(id).select(select);
  if (session) q = q.session(session);
  return q.lean();
}

module.exports = { resolvePlatformOwnerUser, getPlatformOwnerUserId };
