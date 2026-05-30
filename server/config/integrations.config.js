/**
 * Platform registry — add new providers here without touching UI controllers.
 */
const INTEGRATIONS = [
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'streaming',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/spotify',
    metricsKeys: ['followers', 'popularity', 'monthlyListeners'],
    followerField: 'followers',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'video',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/youtube',
    metricsKeys: ['subscribers', 'views', 'videoCount'],
    followerField: 'subscribers',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/instagram',
    metricsKeys: ['followers', 'engagementRate', 'reach'],
    followerField: 'followers',
    parentProvider: 'meta',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    category: 'social',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/instagram',
    metricsKeys: ['followers', 'likes', 'reach'],
    followerField: 'followers',
    parentProvider: 'meta',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'video',
    hasAnalytics: false,
    hasOAuth: false,
    authConnectPath: null,
    metricsKeys: ['followers', 'views'],
    followerField: 'followers',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    category: 'live',
    hasAnalytics: false,
    hasOAuth: false,
    authConnectPath: null,
    metricsKeys: ['followers', 'views'],
    followerField: 'followers',
  },
];

const byId = (id) => INTEGRATIONS.find((p) => p.id === id);

const analyticsProviders = () => INTEGRATIONS.filter((p) => p.hasAnalytics);

module.exports = {
  INTEGRATIONS,
  byId,
  analyticsProviders,
};
