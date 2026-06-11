const EmailProfile = require('../models/EmailProfile');
const MailEvent = require('../models/MailEvent');
const { aggregateWithTenant } = require('../repositories/aggregateWithTenant');
const { SMTP_PRESETS, FREE_ROTATION_PROVIDER_KEYS, getDailyLimitForProvider, getProfileRotationProviders } = require('../utils/smtpPresets');

const todayStr = () => new Date().toISOString().slice(0, 10);

const usesSmtpRotation = (profile) =>
  profile?.rotationEnabled === true
  || profile?.smtpHost === 'rotation'
  || profile?.providerType === 'rotation';

const startOfTodayUtc = () => new Date(`${todayStr()}T00:00:00.000Z`);

const nextResetAtUtc = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

const usageMapToObject = (providerUsage) => {
  if (!providerUsage) return {};
  if (providerUsage instanceof Map) return Object.fromEntries(providerUsage.entries());
  return { ...providerUsage };
};

const getProviderStats = (profile, providerKey) => {
  const map = usageMapToObject(profile.providerUsage);
  const stats = map[providerKey] || { today: 0, total: 0, lastResetDate: todayStr() };
  const today = todayStr();
  if (stats.lastResetDate !== today) {
    return { today: 0, total: stats.total || 0, lastResetDate: today };
  }
  return stats;
};

const isProviderAtLimit = (profile, providerKey) => {
  const stats = getProviderStats(profile, providerKey);
  const limit = getDailyLimitForProvider(providerKey);
  return (stats.today || 0) >= limit;
};

const resolveRotationProvider = async (profile, jobIndex = 0) => {
  const keys = getProfileRotationProviders(profile);
  const start = (jobIndex || 0) % keys.length;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length];
    if (!isProviderAtLimit(profile, key)) {
      return key;
    }
  }
  return null;
};

const incrementProviderSendCount = async (profileId, providerKey) => {
  if (!profileId || !providerKey) return;
  const profile = await EmailProfile.findById(profileId);
  if (!profile) return;

  const today = todayStr();
  if (!profile.providerUsage) profile.providerUsage = new Map();
  const existing = getProviderStats(profile, providerKey);
  const next = {
    today: (existing.today || 0) + 1,
    total: (existing.total || 0) + 1,
    lastResetDate: today,
  };
  profile.providerUsage.set(providerKey, next);

  const map = usageMapToObject(profile.providerUsage);
  const totalToday = Object.values(map).reduce((sum, s) => {
    const st = s.lastResetDate === today ? (s.today || 0) : 0;
    return sum + st;
  }, 0);
  if (!profile.sendStats) profile.sendStats = { today: 0, total: 0, lastResetDate: today };
  profile.sendStats.today = totalToday;
  profile.sendStats.total = (profile.sendStats.total || 0) + 1;
  profile.sendStats.lastResetDate = today;

  profile.markModified('providerUsage');
  await profile.save();
};

const incrementProfileSendCount = async (profileId, providerKey = null) => {
  if (providerKey) return incrementProviderSendCount(profileId, providerKey);
  if (!profileId) return;
  const profile = await EmailProfile.findById(profileId);
  if (!profile) return;
  const today = todayStr();
  if (!profile.sendStats) profile.sendStats = { today: 0, total: 0, lastResetDate: today };
  if (profile.sendStats.lastResetDate !== today) profile.sendStats.today = 0;
  profile.sendStats.today = (profile.sendStats.today || 0) + 1;
  profile.sendStats.total = (profile.sendStats.total || 0) + 1;
  profile.sendStats.lastResetDate = today;
  await profile.save();
};

const getTodaySendCountsByProfileProvider = async () => {
  const start = startOfTodayUtc();
  const counts = new Map();

  const rows = await aggregateWithTenant(MailEvent, [
    {
      $match: {
        eventType: 'Send',
        timestamp: { $gte: start },
        senderProfileId: { $exists: true, $ne: null },
        rotationProvider: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { profileId: '$senderProfileId', provider: '$rotationProvider' },
        count: { $sum: 1 },
      },
    },
  ]);

  for (const row of rows) {
    const key = `${row._id.profileId}:${row._id.provider}`;
    counts.set(key, row.count);
  }

  return counts;
};

const syncProviderUsageFromEvents = async () => {
  const counts = await getTodaySendCountsByProfileProvider();
  const today = todayStr();
  const profileIds = new Set();

  for (const key of counts.keys()) {
    profileIds.add(key.split(':')[0]);
  }

  for (const profileId of profileIds) {
    const profile = await EmailProfile.findById(profileId);
    if (!profile) continue;
    if (!profile.providerUsage) profile.providerUsage = new Map();

    for (const providerKey of getProfileRotationProviders(profile)) {
      const eventCount = counts.get(`${profileId}:${providerKey}`) || 0;
      if (eventCount <= 0) continue;
      const existing = getProviderStats(profile, providerKey);
      if (eventCount > (existing.today || 0)) {
        profile.providerUsage.set(providerKey, {
          today: eventCount,
          total: Math.max(existing.total || 0, eventCount),
          lastResetDate: today,
        });
      }
    }

    const map = usageMapToObject(profile.providerUsage);
    const totalToday = Object.values(map).reduce((sum, s) => {
      const st = s.lastResetDate === today ? (s.today || 0) : 0;
      return sum + st;
    }, 0);
    if (!profile.sendStats) profile.sendStats = { today: 0, total: 0, lastResetDate: today };
    profile.sendStats.today = totalToday;
    profile.sendStats.lastResetDate = today;
    profile.markModified('providerUsage');
    await profile.save();
  }

  return counts;
};

const buildRotationUsage = (profile, eventCounts = new Map()) => {
  const profileId = profile._id.toString();
  const resetAt = nextResetAtUtc();
  const activeKeys = getProfileRotationProviders(profile);
  const providers = activeKeys.map((key) => {
    const stats = getProviderStats(profile, key);
    const eventUsed = eventCounts.get(`${profileId}:${key}`) || 0;
    const used = Math.max(stats.today || 0, eventUsed);
    const limit = getDailyLimitForProvider(key);
    return {
      providerKey: key,
      label: SMTP_PRESETS[key]?.label || key,
      smtpHost: SMTP_PRESETS[key]?.smtpHost || '',
      used,
      limit,
      total: stats.total || 0,
      percent: limit ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      resetAt,
      resetsDaily: true,
    };
  });

  const totalUsed = providers.reduce((sum, p) => sum + p.used, 0);
  const totalLimit = providers.reduce((sum, p) => sum + p.limit, 0);

  return {
    providers,
    activeProviders: activeKeys,
    totalUsed,
    totalLimit,
    resetAt,
    resetLabel: 'Daily at 12:00 AM UTC',
    percent: totalLimit ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0,
  };
};

const buildProfileUsage = (profile, eventCounts = new Map()) => {
  if (usesSmtpRotation(profile)) {
    const rotation = buildRotationUsage(profile, eventCounts);
    return {
      used: rotation.totalUsed,
      limit: rotation.totalLimit,
      total: profile.sendStats?.total || 0,
      percent: rotation.percent,
      rotation,
      resetAt: rotation.resetAt,
      resetLabel: rotation.resetLabel,
    };
  }

  const today = todayStr();
  const stats = profile.sendStats || { today: 0, total: 0, lastResetDate: today };
  const used = stats.lastResetDate === today ? (stats.today || 0) : 0;
  const limit = profile.dailyLimit || getDailyLimitForProvider(profile.providerType);
  return {
    used,
    limit,
    total: stats.total || 0,
    percent: limit ? Math.min(100, Math.round((used / limit) * 100)) : 0,
    resetAt: nextResetAtUtc(),
    resetLabel: 'Daily at 12:00 AM UTC',
  };
};

const resolvePoolProfile = async (profileIds, jobIndex) => {
  if (!profileIds?.length) return null;
  for (let i = 0; i < profileIds.length; i++) {
    const idx = (jobIndex + i) % profileIds.length;
    const profile = await EmailProfile.findById(profileIds[idx]);
    if (!profile) continue;
    if (usesSmtpRotation(profile)) {
      const providerKey = await resolveRotationProvider(profile, jobIndex);
      if (providerKey) return { profile, providerKey };
      continue;
    }
    const stats = profile.sendStats || {};
    const limit = profile.dailyLimit || 500;
    const today = todayStr();
    const used = stats.lastResetDate === today ? (stats.today || 0) : 0;
    if (used < limit) return { profile, providerKey: null };
  }
  return null;
};

module.exports = {
  todayStr,
  nextResetAtUtc,
  usesSmtpRotation,
  resolveRotationProvider,
  getProfileRotationProviders,
  incrementProviderSendCount,
  incrementProfileSendCount,
  resolvePoolProfile,
  getTodaySendCountsByProfileProvider,
  syncProviderUsageFromEvents,
  buildRotationUsage,
  buildProfileUsage,
  isProviderAtLimit,
};
