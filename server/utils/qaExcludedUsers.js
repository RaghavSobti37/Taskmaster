const User = require('../models/User');
const {
  isQaExcludedEmail,
  userMatchesQaExclusion,
  qaExcludedEmailNinFilter,
  QA_EXCLUDED_EMAILS,
} = require('../../shared/qaExcludedUsers');
const { isQaExcludedUser, getQaExcludedUserIds } = require('../../shared/platformUserIds');
const { isQaProbeActive } = require('./qaProbeContext');

let excludedIdCache = null;

async function refreshExcludedUserIds() {
  const emailMatched = await User.find({ email: { $in: QA_EXCLUDED_EMAILS } })
    .select('_id email')
    .lean();
  const platformIds = getQaExcludedUserIds();
  const idSet = new Set([
    ...emailMatched.map((u) => u._id.toString()),
    ...platformIds.map(String),
  ]);
  excludedIdCache = idSet;
  return excludedIdCache;
}

async function getExcludedUserIds() {
  if (!excludedIdCache) await refreshExcludedUserIds();
  return excludedIdCache;
}

async function isQaExcludedUserId(userId) {
  if (!userId) return false;
  if (isQaExcludedUser({ _id: userId })) return true;
  const ids = await getExcludedUserIds();
  return ids.has(userId.toString());
}

/** Skip in-app + email + push when QA probes run. */
async function shouldSuppressNotificationForRecipient(recipientId) {
  if (!isQaProbeActive() || !recipientId) return false;
  return isQaExcludedUserId(recipientId);
}

function pickFirstNonExcludedUser(users = []) {
  return users.find((u) => u && !userMatchesQaExclusion(u) && !isQaExcludedUser(u)) || null;
}

module.exports = {
  isQaExcludedEmail,
  userMatchesQaExclusion,
  qaExcludedEmailNinFilter,
  QA_EXCLUDED_EMAILS,
  refreshExcludedUserIds,
  getExcludedUserIds,
  isQaExcludedUserId,
  shouldSuppressNotificationForRecipient,
  pickFirstNonExcludedUser,
};
