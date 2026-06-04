const User = require('../models/User');
const {
  isQaExcludedEmail,
  userMatchesQaExclusion,
  qaExcludedEmailNinFilter,
  QA_EXCLUDED_EMAILS,
} = require('../../shared/qaExcludedUsers');
const { isQaProbeActive } = require('./qaProbeContext');

let excludedIdCache = null;

async function refreshExcludedUserIds() {
  const matched = await User.find({ email: { $in: QA_EXCLUDED_EMAILS } }).select('_id email').lean();
  excludedIdCache = new Set(matched.map((u) => u._id.toString()));
  return excludedIdCache;
}

async function getExcludedUserIds() {
  if (!excludedIdCache) await refreshExcludedUserIds();
  return excludedIdCache;
}

async function isQaExcludedUserId(userId) {
  if (!userId) return false;
  const ids = await getExcludedUserIds();
  return ids.has(userId.toString());
}

/** Skip in-app + email + push when QA probes run. */
async function shouldSuppressNotificationForRecipient(recipientId) {
  if (!isQaProbeActive() || !recipientId) return false;
  return isQaExcludedUserId(recipientId);
}

function pickFirstNonExcludedUser(users = []) {
  return users.find((u) => u && !userMatchesQaExclusion(u)) || null;
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
