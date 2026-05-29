const EmailProfile = require('../models/EmailProfile');

const todayStr = () => new Date().toISOString().slice(0, 10);

const resetIfNewDay = (profile) => {
  const today = todayStr();
  if (!profile.sendStats) profile.sendStats = { today: 0, lastResetDate: today, total: 0 };
  if (profile.sendStats.lastResetDate !== today) {
    profile.sendStats.today = 0;
    profile.sendStats.lastResetDate = today;
  }
};

const isProfileAtLimit = (profile) => {
  resetIfNewDay(profile);
  const limit = profile.dailyLimit || 500;
  return (profile.sendStats.today || 0) >= limit;
};

const incrementProfileSendCount = async (profileId) => {
  if (!profileId) return;
  const profile = await EmailProfile.findById(profileId);
  if (!profile) return;
  resetIfNewDay(profile);
  profile.sendStats.today = (profile.sendStats.today || 0) + 1;
  profile.sendStats.total = (profile.sendStats.total || 0) + 1;
  profile.sendStats.lastResetDate = todayStr();
  await profile.save();
};

const resolvePoolProfile = async (profileIds, jobIndex) => {
  if (!profileIds?.length) return null;
  for (let i = 0; i < profileIds.length; i++) {
    const idx = (jobIndex + i) % profileIds.length;
    const profile = await EmailProfile.findById(profileIds[idx]);
    if (profile && !isProfileAtLimit(profile)) return profile;
  }
  return null;
};

module.exports = {
  resetIfNewDay,
  isProfileAtLimit,
  incrementProfileSendCount,
  resolvePoolProfile,
};
