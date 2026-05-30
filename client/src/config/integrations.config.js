/** Platform registry — drives dynamic tabs and connect buttons in artist dashboard */
export const INTEGRATIONS = [
  {
    id: 'spotify',
    name: 'Spotify',
    color: 'emerald',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/spotify',
    tabLabel: 'Spotify Catalog',
    followerLabel: 'Followers',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'rose',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/youtube',
    tabLabel: 'YouTube Videos',
    followerLabel: 'Subscribers',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'pink',
    hasAnalytics: true,
    hasOAuth: true,
    authConnectPath: '/api/auth/connect/instagram',
    tabLabel: 'Instagram Media',
    followerLabel: 'Followers',
    mapsFrom: 'meta',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: 'blue',
    hasAnalytics: true,
    hasOAuth: false,
    tabLabel: 'Facebook',
    followerLabel: 'Followers',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: 'slate',
    hasAnalytics: false,
    hasOAuth: false,
    tabLabel: 'TikTok',
    followerLabel: 'Followers',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    color: 'purple',
    hasAnalytics: false,
    hasOAuth: false,
    tabLabel: 'Twitch',
    followerLabel: 'Followers',
  },
];

export const byId = (id) => INTEGRATIONS.find((p) => p.id === id);

export const analyticsIntegrations = () => INTEGRATIONS.filter((p) => p.hasAnalytics);

export const formatNumber = (num) => {
  if (num == null || isNaN(num) || num === 'N/A' || num === '—') return '—';
  const n = Number(num);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

/** Build public profile URL for a connected platform */
export function getProfileUrl(provider, { connection, artist } = {}) {
  const creds = artist?.oauthCredentials || {};
  const meta = connection?.metadata || {};

  if (provider === 'spotify') {
    const id = connection?.accountHandle || meta.artistId || creds.spotify?.artistId;
    return id ? `https://open.spotify.com/artist/${id}` : null;
  }
  if (provider === 'youtube') {
    const id = connection?.accountHandle || meta.channelId || creds.youtube?.channelId;
    return id ? `https://www.youtube.com/channel/${id}` : null;
  }
  if (provider === 'instagram') {
    const username = meta.igUsername || creds.meta?.igUsername;
    if (username) return `https://www.instagram.com/${username.replace(/^@/, '')}/`;
    const id = connection?.accountHandle || meta.igAccountId || creds.meta?.igAccountId;
    return id ? `https://www.instagram.com/` : null;
  }
  if (provider === 'facebook') {
    const pageId = connection?.accountHandle || meta.fbPageId || creds.meta?.fbPageId;
    const link = meta.link || creds.meta?.fbLink;
    if (link) return link;
    return pageId ? `https://www.facebook.com/${pageId}` : null;
  }
  return null;
};

export function computeFallbackReach(artist) {
  if (!artist?.analytics) return 0;
  const a = artist.analytics;
  return (Number(a.spotify?.followers) || 0)
    + (Number(a.youtube?.subscribers) || 0)
    + (Number(a.instagram?.followers) || 0)
    + (Number(a.facebook?.followers) || 0);
}
