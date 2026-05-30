const { byId } = require('../config/integrations.config');

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
      engagementRate: analytics.spotify.popularity,
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
      reach: analytics.instagram.totalShares,
      totalEngagement: analytics.instagram.totalShares,
    }, historyByPlatform.instagram);
  }

  if (analytics.facebook) {
    platforms.facebook = normalizePlatform('facebook', {
      followers: analytics.facebook.followers,
      likes: analytics.facebook.likes,
      reach: analytics.facebook.postReach?.organic,
    }, historyByPlatform.facebook);
  }

  const activeProviders = connections.length
    ? [...new Set(connections.filter((c) => c.status === 'active').map((c) => c.provider))]
    : Object.keys(platforms);

  const unifiedReach = activeProviders.reduce((sum, p) => sum + (platforms[p]?.followers || 0), 0);
  const avgEngagement = activeProviders.length
    ? Number((activeProviders.reduce((s, p) => s + (platforms[p]?.engagementRate || 0), 0) / activeProviders.length).toFixed(2))
    : 0;
  const avgTrend = activeProviders.length
    ? Math.round(activeProviders.reduce((s, p) => s + (platforms[p]?.trendScore || 0), 0) / activeProviders.length)
    : 0;

  return {
    platforms,
    unified: {
      reach: unifiedReach,
      engagementRate: avgEngagement,
      growth: activeProviders.reduce((s, p) => s + (platforms[p]?.growth || 0), 0) / (activeProviders.length || 1),
      trendScore: avgTrend,
      connectedCount: activeProviders.length,
    },
  };
}

module.exports = { normalizePlatform, normalizeAll, num };
