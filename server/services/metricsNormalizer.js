const { byId } = require('../config/integrations.config');

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Map DB provider ids to analytics platform keys (meta → instagram). */
function analyticsPlatformKey(provider) {
  if (provider === 'meta') return 'instagram';
  return provider;
}

function isLinkedConnection(conn) {
  if (!conn) return false;
  if (conn.status === 'active' || conn.accountHandle) return true;
  const meta = conn.metadata || {};
  return !!(meta.igAccountId || meta.artistId || meta.channelId || meta.fbPageId);
}

function normalizePlatform(provider, raw = {}, history = []) {
  const config = byId(provider) || {};
  const followerKey = config.followerField || 'followers';
  const followers = num(raw[followerKey] ?? raw.followers ?? raw.subscribers);

  let engagementRate = num(raw.engagementRate);
  if (!engagementRate && raw.totalEngagement && followers) {
    engagementRate = Number(((raw.totalEngagement / followers) * 100).toFixed(2));
  }
  if (!engagementRate && raw.likes && raw.comments && followers) {
    engagementRate = Number((((raw.likes + raw.comments) / followers) * 100).toFixed(2));
  }

  const reach = num(raw.reach ?? raw.views ?? raw.monthlyListeners ?? followers);

  const histFollowers = history
    .map((h) => ({
      date: h.timestamp || h.date,
      value: num(h.metrics?.[followerKey] ?? h.metrics?.followers ?? h.metrics?.subscribers ?? h.followers),
    }))
    .filter((h) => h.value > 0);

  let growth = 0;
  if (histFollowers.length >= 2) {
    const first = histFollowers[0].value;
    const last = histFollowers[histFollowers.length - 1].value;
    growth = first > 0 ? Number((((last - first) / first) * 100).toFixed(2)) : 0;
  }

  const trendScore = Math.min(100, Math.max(0, Math.round(
    (engagementRate * 2) + (growth > 0 ? Math.min(growth, 30) : 0) + (followers > 1000 ? 10 : 0)
  )));

  return {
    provider,
    name: config.name || provider,
    followers,
    engagementRate,
    reach,
    growth,
    trendScore,
    raw,
  };
}

function normalizeAll(analytics = {}, analyticsHistory = [], connections = []) {
  const historyByPlatform = { spotify: [], youtube: [], instagram: [], facebook: [] };

  (analyticsHistory || []).forEach((item) => {
    const ts = item.timestamp;
    if (item.platform === 'overall' && item.metrics) {
      if (item.metrics.spotify) historyByPlatform.spotify.push({ timestamp: ts, metrics: item.metrics.spotify });
      if (item.metrics.youtube) historyByPlatform.youtube.push({ timestamp: ts, metrics: item.metrics.youtube });
      if (item.metrics.instagram) historyByPlatform.instagram.push({ timestamp: ts, metrics: item.metrics.instagram });
    } else if (historyByPlatform[item.platform]) {
      historyByPlatform[item.platform].push(item);
    }
  });

  const platforms = {};

  if (analytics.spotify) {
    platforms.spotify = normalizePlatform('spotify', {
      followers: analytics.spotify.followers,
      popularity: analytics.spotify.popularity,
      monthlyListeners: analytics.spotify.monthlyListeners,
    }, historyByPlatform.spotify);
  }

  if (analytics.youtube) {
    platforms.youtube = normalizePlatform('youtube', {
      subscribers: analytics.youtube.subscribers,
      views: analytics.youtube.views,
      videoCount: analytics.youtube.videoCount,
      reach: analytics.youtube.views,
    }, historyByPlatform.youtube);
  }

  if (analytics.instagram) {
    platforms.instagram = normalizePlatform('instagram', {
      followers: analytics.instagram.followers,
      engagementRate: analytics.instagram.engagementRate,
    }, historyByPlatform.instagram);
  }

  if (analytics.facebook) {
    platforms.facebook = normalizePlatform('facebook', {
      followers: analytics.facebook.followers,
      likes: analytics.facebook.likes,
      reach: analytics.facebook.postReach?.organic,
    }, historyByPlatform.facebook);
  }

  const linkedKeys = connections.length
    ? [...new Set(
      connections
        .filter(isLinkedConnection)
        .map((c) => analyticsPlatformKey(c.provider))
        .filter((p) => platforms[p]),
    )]
    : Object.keys(platforms);

  const reachKeys = linkedKeys.length ? linkedKeys : Object.keys(platforms);
  const unifiedReach = reachKeys.reduce((sum, p) => sum + (platforms[p]?.followers || 0), 0);

  const engagementPlatforms = reachKeys.filter((p) => platforms[p]?.engagementRate > 0);
  const avgEngagement = engagementPlatforms.length
    ? Number((engagementPlatforms.reduce((s, p) => s + (platforms[p]?.engagementRate || 0), 0) / engagementPlatforms.length).toFixed(2))
    : 0;
  const avgTrend = reachKeys.length
    ? Math.round(reachKeys.reduce((s, p) => s + (platforms[p]?.trendScore || 0), 0) / reachKeys.length)
    : 0;

  const connectedCount = connections.length
    ? [...new Set(connections.filter(isLinkedConnection).map((c) => analyticsPlatformKey(c.provider)))].length
    : Object.keys(platforms).length;

  return {
    platforms,
    unified: {
      reach: unifiedReach,
      engagementRate: avgEngagement,
      growth: reachKeys.reduce((s, p) => s + (platforms[p]?.growth || 0), 0) / (reachKeys.length || 1),
      trendScore: avgTrend,
      connectedCount,
    },
  };
}

module.exports = {
  normalizePlatform,
  normalizeAll,
  num,
  analyticsPlatformKey,
  isLinkedConnection,
};
