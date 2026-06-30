const Artist = require('../../../models/Artist');
const ArtistSocialProfile = require('../../../models/ArtistSocialProfile');
const ArtistConnection = require('../../../models/ArtistConnection');
const {
  INTEGRATIONS,
  INTEGRATION_CATEGORIES,
  byId,
} = require('../../../config/integrations.config');
const {
  sanitizeConnection,
} = require('./connectionService');
const { loadConnections } = require('./artistEnrichmentService');
const { getProvider, isLiveProvider } = require('../providers');

function connectionHasHandle(connection, platformId) {
  if (!connection) return false;
  if (connection.accountHandle) return true;
  const meta = connection.metadata || {};
  if (platformId === 'instagram') {
    return !!(meta.igAccountId);
  }
  if (platformId === 'spotify') {
    return !!(meta.artistId);
  }
  if (platformId === 'youtube') {
    return !!(meta.channelId);
  }
  if (platformId === 'facebook') {
    return !!(meta.fbPageId);
  }
  return false;
}

function resolveHubStatus(platform, connection, profile) {
  const config = byId(platform.id);
  if (!config?.hasOAuth && config?.connectMethod === 'coming_soon') {
    return 'coming_soon';
  }
  if (profile?.status === 'manual' || (config?.connectMethod === 'manual' && profile?.accountName)) {
    return 'manual';
  }
  if (connection?.status === 'expired') return 'expired';
  if (connection?.lastError || profile?.status === 'error') return 'error';
  if (connection?.status === 'pending_reauth') return 'pending';
  if (connectionHasHandle(connection, platform.id) || profile?.status === 'connected') return 'connected';
  if (profile?.lastSync && typeof profile?.followers === 'number') return 'connected';
  if (config?.connectMethod === 'manual') return 'manual';
  return 'disconnected';
}

function findConnectionForPlatform(connections, platformId) {
  if (platformId === 'instagram') {
    return connections.find((c) => c.provider === 'instagram' && c.isPrimary)
      || connections.find((c) => c.provider === 'instagram')
      || connections.find((c) => c.provider === 'meta');
  }
  if (platformId === 'facebook') {
    return connections.find((c) => c.provider === 'facebook' && c.isPrimary)
      || connections.find((c) => c.provider === 'facebook');
  }
  return connections.find((c) => c.provider === platformId && c.isPrimary)
    || connections.find((c) => c.provider === platformId);
}

async function upsertSocialProfile({
  artistId,
  platform,
  patch,
  connectionId,
}) {
  return ArtistSocialProfile.findOneAndUpdate(
    { artistId, platform },
    {
      $set: {
        artistId,
        platform,
        ...patch,
        ...(connectionId ? { connectionId } : {}),
      },
    },
    { upsert: true, new: true },
  ).lean();
}

async function buildConnectionHub(artistId) {
  const artist = await Artist.findById(artistId).lean();
  if (!artist) return null;

  const [connections, profiles] = await Promise.all([
    loadConnections(artistId, artist),
    ArtistSocialProfile.find({ artistId }).lean(),
  ]);

  const profileByPlatform = new Map(profiles.map((p) => [p.platform, p]));

  const platforms = INTEGRATIONS.map((platform) => {
    const connection = findConnectionForPlatform(connections, platform.id);
    const profile = profileByPlatform.get(platform.id);
    const provider = getProvider(platform.id);
    const health = provider.getHealth(connection);
    const hubStatus = resolveHubStatus(platform, connection, profile);

    return {
      ...platform,
      hubStatus,
      health,
      connection: connection ? sanitizeConnection(connection) : null,
      profile: profile ? {
        accountName: profile.accountName,
        accountId: profile.accountId,
        followers: profile.followers,
        verified: profile.verified,
        lastSync: profile.lastSync,
        status: profile.status,
        connectionId: profile.connectionId,
      } : null,
    };
  });

  return {
    artistId,
    categories: INTEGRATION_CATEGORIES,
    platforms,
  };
}

async function getConnectionHealthSummary(artistId) {
  const hub = await buildConnectionHub(artistId);
  if (!hub) return null;

  return {
    artistId,
    items: hub.platforms
      .filter((p) => p.hubStatus !== 'coming_soon' || p.connection || p.profile)
      .map((p) => ({
        platform: p.id,
        name: p.name,
        category: p.category,
        hubStatus: p.hubStatus,
        lastSync: p.profile?.lastSync || p.connection?.lastSyncedAt || p.health?.lastSync || null,
        status: p.health?.status || p.hubStatus,
        lastError: p.health?.lastError || p.connection?.lastError || null,
      })),
  };
}

async function syncPlatformAnalytics(artistId, platformId) {
  const config = byId(platformId);
  if (!config) {
    const err = new Error(`Unknown platform: ${platformId}`);
    err.status = 404;
    throw err;
  }

  if (!isLiveProvider(platformId)) {
    const err = new Error(`${config.name} does not support sync yet`);
    err.status = 400;
    throw err;
  }

  const provider = getProvider(platformId);
  const connections = await loadConnections(artistId);
  const connection = findConnectionForPlatform(connections, platformId);

  if (!connection) {
    const err = new Error(`No ${config.name} connection found — connect OAuth first`);
    err.status = 400;
    throw err;
  }

  const result = await provider.syncAnalytics(artistId, connection);
  if (result?.status === 'error') {
    await ArtistConnection.updateOne(
      { _id: connection._id },
      { $set: { lastError: result.lastError || 'Sync failed' } },
    );
    const err = new Error(result.lastError || 'Sync failed');
    err.status = 502;
    throw err;
  }

  const now = new Date();
  await ArtistConnection.updateOne(
    { _id: connection._id },
    { $set: { lastSyncedAt: now, lastError: null } },
  );

  const profile = await upsertSocialProfile({
    artistId,
    platform: platformId,
    connectionId: connection._id,
    patch: {
      accountName: result.accountName || connection.accountLabel || config.name,
      accountId: result.accountId || connection.accountHandle || '',
      followers: result.followers,
      verified: result.verified || false,
      lastSync: now,
      status: 'connected',
      metadata: { ...(result.metrics || {}), syncedAt: now },
    },
  });

  return { platform: platformId, synced: true, profile, metrics: result.metrics || {} };
}

async function saveManualProfile(artistId, platformId, { accountName }) {
  const config = byId(platformId);
  if (!config) {
    const err = new Error(`Unknown platform: ${platformId}`);
    err.status = 404;
    throw err;
  }
  if (config.connectMethod !== 'manual') {
    const err = new Error(`${config.name} does not support manual handles`);
    err.status = 400;
    throw err;
  }

  const profile = await upsertSocialProfile({
    artistId,
    platform: platformId,
    patch: {
      accountName: accountName || '',
      accountId: accountName || '',
      status: 'manual',
      lastSync: null,
    },
  });

  return { platform: platformId, profile };
}

/** After full syncArtistStats — mirror analytics into ArtistSocialProfile rows. */
async function refreshProfilesFromAnalytics(artistId, analytics = {}, connections = []) {
  const now = new Date();
  const tasks = [];

  const spotifyConn = findConnectionForPlatform(connections, 'spotify');
  if (spotifyConn || analytics.spotify) {
    tasks.push(upsertSocialProfile({
      artistId,
      platform: 'spotify',
      connectionId: spotifyConn?._id,
      patch: {
        accountName: spotifyConn?.accountLabel || 'Spotify',
        accountId: spotifyConn?.accountHandle || '',
        followers: typeof analytics.spotify?.followers === 'number' ? analytics.spotify.followers : undefined,
        lastSync: now,
        status: spotifyConn ? 'connected' : 'pending',
        metadata: { popularity: analytics.spotify?.popularity },
      },
    }));
  }

  const ytConn = findConnectionForPlatform(connections, 'youtube');
  if (ytConn || analytics.youtube) {
    tasks.push(upsertSocialProfile({
      artistId,
      platform: 'youtube',
      connectionId: ytConn?._id,
      patch: {
        accountName: ytConn?.accountLabel || 'YouTube',
        accountId: ytConn?.accountHandle || '',
        followers: typeof analytics.youtube?.subscribers === 'number' ? analytics.youtube.subscribers : undefined,
        lastSync: now,
        status: ytConn ? 'connected' : 'pending',
        metadata: { views: analytics.youtube?.views, videoCount: analytics.youtube?.videoCount },
      },
    }));
  }

  const igConn = findConnectionForPlatform(connections, 'instagram');
  if (igConn || analytics.instagram) {
    tasks.push(upsertSocialProfile({
      artistId,
      platform: 'instagram',
      connectionId: igConn?._id,
      patch: {
        accountName: igConn?.accountLabel || 'Instagram',
        accountId: igConn?.accountHandle || '',
        followers: typeof analytics.instagram?.followers === 'number' ? analytics.instagram.followers : undefined,
        lastSync: now,
        status: igConn ? 'connected' : 'pending',
        metadata: { engagementRate: analytics.instagram?.engagementRate },
      },
    }));
  }

  await Promise.all(tasks);
}

module.exports = {
  buildConnectionHub,
  getConnectionHealthSummary,
  syncPlatformAnalytics,
  saveManualProfile,
  refreshProfilesFromAnalytics,
  upsertSocialProfile,
  resolveHubStatus,
};
