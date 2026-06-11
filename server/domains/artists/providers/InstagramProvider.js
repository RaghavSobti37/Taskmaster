const ConnectionProvider = require('./ConnectionProvider');
const { validateMetric } = require('../../../utils/nullishValidator');
const { fetchMetaAnalytics } = require('../../../services/metaGraphService');
const { getCredentialsForSync } = require('../services/connectionService');

class InstagramProvider extends ConnectionProvider {
  constructor() {
    super('instagram');
  }

  async connect(artistId) {
    return {
      authUrl: null,
      status: 'pending',
      message: 'Use Meta OAuth flow via /api/auth/connect/instagram',
      artistId,
    };
  }

  async refresh(connection) {
    const tokens = connection?._tokens || {};
    return {
      accessToken: tokens.accessToken || null,
      refreshToken: tokens.refreshToken || null,
      expiresAt: tokens.expiresAt || null,
    };
  }

  async syncAnalytics(artistId, connection) {
    const oauthCredentials = await getCredentialsForSync(artistId);
    const metaCreds = oauthCredentials?.meta || {};
    if (!metaCreds.accessToken && !metaCreds.igAccountId && !process.env.META_USER_TOKEN) {
      return { status: 'error', lastError: 'No Meta/Instagram credentials configured' };
    }

    const metaRes = await fetchMetaAnalytics(metaCreds);
    if (!metaRes) {
      return { status: 'error', lastError: 'Meta analytics fetch returned empty' };
    }

    const followers = validateMetric(metaRes.followers, true);
    const igUsername = metaRes.igUsername || connection?.metadata?.igUsername;

    return {
      metrics: {
        followers,
        engagementRate: null,
        igAccountId: metaRes.igAccountId,
        igUsername,
      },
      accountName: igUsername ? `@${igUsername.replace(/^@/, '')}` : (connection?.accountLabel || 'Instagram'),
      accountId: metaRes.igAccountId || connection?.accountHandle || '',
      followers: typeof followers === 'number' ? followers : undefined,
      verified: false,
    };
  }
}

module.exports = InstagramProvider;
