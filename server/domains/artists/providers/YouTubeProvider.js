const axios = require('axios');
const ConnectionProvider = require('./ConnectionProvider');
const { validateMetric } = require('../../../utils/nullishValidator');
class YouTubeProvider extends ConnectionProvider {
  constructor() {
    super('youtube');
  }

  async connect(artistId) {
    return { authUrl: `/api/auth/connect/youtube`, artistId, provider: 'youtube' };
  }

  async refresh(connection) {
    const tokens = connection?._tokens || {};
    return {
      accessToken: tokens.accessToken || null,
      refreshToken: tokens.refreshToken || null,
      expiresAt: tokens.expiresAt || null,
    };
  }

  async syncAnalytics(_artistId, connection) {
    const channelId = connection?.accountHandle || connection?.metadata?.channelId;
    if (!channelId) {
      return { status: 'error', lastError: 'No YouTube channel ID configured' };
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      return { status: 'error', lastError: 'YouTube API key unconfigured' };
    }

    const { data } = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${youtubeApiKey}`,
      { timeout: 10000 },
    );
    const channel = data.items?.[0];
    if (!channel) {
      return { status: 'error', lastError: 'YouTube channel not found' };
    }

    const subscribers = validateMetric(channel.statistics?.subscriberCount, true);
    const views = validateMetric(channel.statistics?.viewCount, true);
    const videoCount = validateMetric(channel.statistics?.videoCount, true);

    return {
      metrics: { subscribers, views, videoCount },
      accountName: channel.snippet?.title || connection?.accountLabel || 'YouTube',
      accountId: channelId,
      followers: typeof subscribers === 'number' ? subscribers : undefined,
      verified: false,
    };
  }
}

module.exports = YouTubeProvider;
