const { normalizeAll, analyticsPlatformKey, isLinkedConnection } = require('../services/metricsNormalizer');

describe('metricsNormalizer', () => {
  it('maps meta provider to instagram for reach totals', () => {
    const analytics = {
      spotify: { followers: 100 },
      youtube: { subscribers: 22 },
      instagram: { followers: 1300 },
    };
    const connections = [
      { provider: 'spotify', status: 'active', accountHandle: 'sp-1' },
      { provider: 'youtube', status: 'active', accountHandle: 'yt-1' },
      { provider: 'meta', status: 'active', accountHandle: '', metadata: { igAccountId: 'ig-1' } },
    ];

    const result = normalizeAll(analytics, [], connections);

    expect(analyticsPlatformKey('meta')).toBe('instagram');
    expect(isLinkedConnection(connections[2])).toBe(true);
    expect(result.unified.reach).toBe(1422);
    expect(result.unified.connectedCount).toBe(3);
  });

  it('does not treat spotify popularity as engagement rate', () => {
    const analytics = {
      spotify: { followers: 0, popularity: 72 },
      instagram: { followers: 1000, engagementRate: 4.5 },
    };
    const connections = [
      { provider: 'spotify', status: 'active', accountHandle: 'sp-1' },
      { provider: 'instagram', status: 'active', accountHandle: 'ig-1' },
    ];

    const result = normalizeAll(analytics, [], connections);

    expect(result.platforms.spotify.engagementRate).toBe(0);
    expect(result.unified.engagementRate).toBe(4.5);
  });

  it('does not inflate instagram engagement from totalShares', () => {
    const analytics = {
      instagram: { followers: 1300, totalShares: 3100 },
    };
    const connections = [
      { provider: 'instagram', status: 'active', accountHandle: 'ig-1' },
    ];

    const result = normalizeAll(analytics, [], connections);

    expect(result.platforms.instagram.engagementRate).toBe(0);
    expect(result.unified.engagementRate).toBe(0);
  });
});
