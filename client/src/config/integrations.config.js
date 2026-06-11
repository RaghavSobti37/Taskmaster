/** Platform registry — drives dynamic tabs and connect buttons in artist dashboard */
export const INTEGRATION_CATEGORIES = [
  { id: 'music', label: 'Music' },
  { id: 'social', label: 'Social' },
  { id: 'creator', label: 'Creator' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'ticketing', label: 'Ticketing' },
];

export const INTEGRATIONS = [
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'music',
    color: 'emerald',
    colorClass: 'emerald',
    icon: 'spotify',
    hasAnalytics: true,
    hasOAuth: true,
    connectMethod: 'oauth',
    authConnectPath: '/api/auth/connect/spotify',
    tabLabel: 'Spotify Catalog',
    followerLabel: 'Followers',
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    category: 'music',
    color: 'rose',
    colorClass: 'rose',
    icon: 'apple-music',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Apple Music',
    followerLabel: 'Followers',
  },
  {
    id: 'jiosaavn',
    name: 'JioSaavn',
    category: 'music',
    color: 'green',
    colorClass: 'green',
    icon: 'jiosaavn',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'JioSaavn',
    followerLabel: 'Followers',
  },
  {
    id: 'gaana',
    name: 'Gaana',
    category: 'music',
    color: 'orange',
    colorClass: 'orange',
    icon: 'gaana',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Gaana',
    followerLabel: 'Followers',
  },
  {
    id: 'wynk',
    name: 'Wynk',
    category: 'music',
    color: 'red',
    colorClass: 'red',
    icon: 'wynk',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Wynk',
    followerLabel: 'Followers',
  },
  {
    id: 'amazon-music',
    name: 'Amazon Music',
    category: 'music',
    color: 'cyan',
    colorClass: 'cyan',
    icon: 'amazon-music',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Amazon Music',
    followerLabel: 'Followers',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    category: 'music',
    color: 'orange',
    colorClass: 'orange',
    icon: 'soundcloud',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'manual',
    tabLabel: 'SoundCloud',
    followerLabel: 'Followers',
  },
  {
    id: 'audiomack',
    name: 'Audiomack',
    category: 'music',
    color: 'amber',
    colorClass: 'amber',
    icon: 'audiomack',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Audiomack',
    followerLabel: 'Followers',
  },
  {
    id: 'beatport',
    name: 'Beatport',
    category: 'music',
    color: 'lime',
    colorClass: 'lime',
    icon: 'beatport',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Beatport',
    followerLabel: 'Followers',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'social',
    color: 'rose',
    colorClass: 'rose',
    icon: 'youtube',
    hasAnalytics: true,
    hasOAuth: true,
    connectMethod: 'oauth',
    authConnectPath: '/api/auth/connect/youtube',
    tabLabel: 'YouTube Videos',
    followerLabel: 'Subscribers',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    color: 'pink',
    colorClass: 'pink',
    icon: 'instagram',
    hasAnalytics: true,
    hasOAuth: true,
    connectMethod: 'oauth',
    authConnectPath: '/api/auth/connect/instagram',
    tabLabel: 'Instagram Media',
    followerLabel: 'Followers',
    mapsFrom: 'meta',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    category: 'social',
    color: 'blue',
    colorClass: 'blue',
    icon: 'facebook',
    hasAnalytics: true,
    hasOAuth: false,
    connectMethod: 'manual',
    authConnectPath: null,
    tabLabel: 'Facebook',
    followerLabel: 'Followers',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'social',
    color: 'slate',
    colorClass: 'slate',
    icon: 'tiktok',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'manual',
    tabLabel: 'TikTok',
    followerLabel: 'Followers',
  },
  {
    id: 'threads',
    name: 'Threads',
    category: 'social',
    color: 'zinc',
    colorClass: 'zinc',
    icon: 'threads',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Threads',
    followerLabel: 'Followers',
  },
  {
    id: 'x',
    name: 'X',
    category: 'social',
    color: 'neutral',
    colorClass: 'neutral',
    icon: 'x',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'X',
    followerLabel: 'Followers',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'social',
    color: 'sky',
    colorClass: 'sky',
    icon: 'linkedin',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'LinkedIn',
    followerLabel: 'Followers',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    category: 'social',
    color: 'yellow',
    colorClass: 'yellow',
    icon: 'snapchat',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Snapchat',
    followerLabel: 'Followers',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'social',
    color: 'indigo',
    colorClass: 'indigo',
    icon: 'discord',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'manual',
    tabLabel: 'Discord',
    followerLabel: 'Members',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'social',
    color: 'sky',
    colorClass: 'sky',
    icon: 'telegram',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'manual',
    tabLabel: 'Telegram',
    followerLabel: 'Members',
  },
  {
    id: 'patreon',
    name: 'Patreon',
    category: 'creator',
    color: 'orange',
    colorClass: 'orange',
    icon: 'patreon',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Patreon',
    followerLabel: 'Patrons',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    category: 'creator',
    color: 'purple',
    colorClass: 'purple',
    icon: 'twitch',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Twitch',
    followerLabel: 'Followers',
  },
  {
    id: 'substack',
    name: 'Substack',
    category: 'creator',
    color: 'orange',
    colorClass: 'orange',
    icon: 'substack',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Substack',
    followerLabel: 'Subscribers',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'commerce',
    color: 'green',
    colorClass: 'green',
    icon: 'shopify',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Shopify',
    followerLabel: 'Customers',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'commerce',
    color: 'purple',
    colorClass: 'purple',
    icon: 'woocommerce',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'WooCommerce',
    followerLabel: 'Customers',
  },
  {
    id: 'bookmyshow',
    name: 'BookMyShow',
    category: 'ticketing',
    color: 'red',
    colorClass: 'red',
    icon: 'bookmyshow',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'BookMyShow',
    followerLabel: 'Events',
  },
  {
    id: 'insider',
    name: 'Insider',
    category: 'ticketing',
    color: 'pink',
    colorClass: 'pink',
    icon: 'insider',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Insider',
    followerLabel: 'Events',
  },
  {
    id: 'skillbox',
    name: 'Skillbox',
    category: 'ticketing',
    color: 'violet',
    colorClass: 'violet',
    icon: 'skillbox',
    hasAnalytics: false,
    hasOAuth: false,
    connectMethod: 'coming_soon',
    tabLabel: 'Skillbox',
    followerLabel: 'Events',
  },
];

export const byId = (id) => INTEGRATIONS.find((p) => p.id === id);

export const byCategory = (category) => INTEGRATIONS.filter((p) => p.category === category);

export const integrationsByCategory = () => {
  const grouped = Object.fromEntries(INTEGRATION_CATEGORIES.map((c) => [c.id, []]));
  INTEGRATIONS.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });
  return grouped;
};

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
  if (provider === 'soundcloud' && artist?.socials?.soundcloud) {
    return artist.socials.soundcloud.startsWith('http')
      ? artist.socials.soundcloud
      : `https://soundcloud.com/${artist.socials.soundcloud.replace(/^@/, '')}`;
  }
  return null;
}

export function computeFallbackReach(artist) {
  if (!artist?.analytics) return 0;
  const a = artist.analytics;
  return (Number(a.spotify?.followers) || 0)
    + (Number(a.youtube?.subscribers) || 0)
    + (Number(a.instagram?.followers) || 0)
    + (Number(a.facebook?.followers) || 0);
}
