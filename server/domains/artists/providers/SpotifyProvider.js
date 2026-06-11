const axios = require('axios');
const ConnectionProvider = require('./ConnectionProvider');
const { getSpotifyAccessToken } = require('../services/spotifyTokenManager');
const { validateMetric } = require('../../../utils/nullishValidator');
class SpotifyProvider extends ConnectionProvider {
  constructor() {
    super('spotify');
  }

  async connect(artistId) {
    return { authUrl: `/api/auth/connect/spotify`, artistId, provider: 'spotify' };
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
    const artistIdSpotify = connection?.accountHandle || connection?.metadata?.artistId;
    if (!artistIdSpotify) {
      return { status: 'error', lastError: 'No Spotify artist ID configured' };
    }

    const token = await getSpotifyAccessToken();
    const { data: artistInfo } = await axios.get(
      `https://api.spotify.com/v1/artists/${artistIdSpotify}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
    );

    const followers = validateMetric(artistInfo?.followers?.total, true);
    const popularity = validateMetric(artistInfo?.popularity, true);

    return {
      metrics: {
        followers,
        popularity,
        genres: artistInfo?.genres || [],
        profileImage: artistInfo?.images?.[0]?.url || null,
      },
      accountName: artistInfo?.name || connection?.accountLabel || 'Spotify',
      accountId: artistIdSpotify,
      followers: typeof followers === 'number' ? followers : undefined,
      verified: false,
    };
  }
}

module.exports = SpotifyProvider;
