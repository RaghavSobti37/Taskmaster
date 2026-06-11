const { INTEGRATIONS, byId } = require('../../../config/integrations.config');
const SpotifyProvider = require('./SpotifyProvider');
const YouTubeProvider = require('./YouTubeProvider');
const InstagramProvider = require('./InstagramProvider');
const StubProvider = require('./StubProvider');

const LIVE_PROVIDERS = {
  spotify: SpotifyProvider,
  youtube: YouTubeProvider,
  instagram: InstagramProvider,
};

const providerCache = new Map();

function getProvider(platformId) {
  const id = platformId === 'meta' ? 'instagram' : platformId;
  if (providerCache.has(id)) return providerCache.get(id);

  const ProviderClass = LIVE_PROVIDERS[id];
  if (ProviderClass) {
    const instance = new ProviderClass();
    providerCache.set(id, instance);
    return instance;
  }

  const config = byId(id);
  const stub = new StubProvider(id, { connectMethod: config?.connectMethod || 'coming_soon' });
  providerCache.set(id, stub);
  return stub;
}

function listProviderIds() {
  return INTEGRATIONS.map((p) => p.id);
}

function isLiveProvider(platformId) {
  const id = platformId === 'meta' ? 'instagram' : platformId;
  return Boolean(LIVE_PROVIDERS[id]);
}

module.exports = {
  getProvider,
  listProviderIds,
  isLiveProvider,
  LIVE_PROVIDERS: Object.keys(LIVE_PROVIDERS),
};
