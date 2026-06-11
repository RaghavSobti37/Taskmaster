const mongoose = require('mongoose');
const Artist = require('../../../models/Artist');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const ArtistAuth = require('../../../models/ArtistAuth');
const {
  getConnectionsForArtist,
  sanitizeConnection,
  buildLegacyOAuthShape,
  migrateAuthDocToConnections,
} = require('./connectionService');
const { normalizeAll } = require('../../../services/metricsNormalizer');
const { INTEGRATIONS } = require('../../../config/integrations.config');

async function loadMetrics(artistId) {
  return ArtistMetrics.findOne({ artistId }).lean();
}

async function loadConnections(artistId, legacyArtist = null) {
  let connections = await getConnectionsForArtist(artistId, { includeTokens: true });
  if (connections.length > 0) return connections;

  const auth = await ArtistAuth.findOne({ artistId }).lean();
  if (auth) {
    await migrateAuthDocToConnections(artistId, auth);
  } else {
    const oauth = legacyArtist?.oauthCredentials
      || (await Artist.collection.findOne({ _id: artistId }))?.oauthCredentials;
    if (oauth) {
      await migrateAuthDocToConnections(artistId, { oauthCredentials: oauth });
    }
  }
  return getConnectionsForArtist(artistId, { includeTokens: true });
}

function enrichOne(artist, metrics, connections) {
  const analytics = metrics?.analytics || {};
  const sanitized = connections.map((c) => ({
    ...sanitizeConnection(c),
    authenticated: !!(c._tokens?.accessToken),
  }));
  const oauthCredentials = connections.length
    ? buildLegacyOAuthShape(connections.map((c) => ({ ...c, _tokens: {} })))
    : (artist.oauthCredentials || buildLegacyOAuthShape(connections.map((c) => ({ ...c, _tokens: {} }))));

  const isSynced = connections.some((c) => c.status === 'active')
    || (metrics?.analytics && Object.keys(metrics.analytics).length > 0);

  const normalized = normalizeAll(
    analytics,
    metrics?.analyticsHistory || [],
    sanitized
  );

  return {
    ...artist,
    analytics,
    trackedVideos: metrics?.trackedVideos || [],
    analyticsHistory: metrics?.analyticsHistory || [],
    history: metrics?.history || [],
    isSynced: !!isSynced,
    connections: sanitized,
    oauthCredentials,
    normalized,
    integrations: INTEGRATIONS,
  };
}

async function enrichArtistById(artistId) {
  if (!mongoose.Types.ObjectId.isValid(artistId)) return null;
  const artist = await Artist.findById(artistId).lean();
  if (!artist) return null;
  const [metrics, connections] = await Promise.all([
    loadMetrics(artistId),
    loadConnections(artistId, artist),
  ]);
  return enrichOne(artist, metrics, connections);
}

async function enrichAllArtists() {
  const artists = await Artist.find().sort({ name: 1 }).lean();
  if (!artists.length) return [];

  const ids = artists.map((a) => a._id);
  const metricsList = await ArtistMetrics.find({ artistId: { $in: ids } }).lean();
  const metricsMap = new Map(metricsList.map((m) => [String(m.artistId), m]));

  const connByArtist = new Map();
  for (const id of ids) {
    connByArtist.set(String(id), []);
  }

  const allConnections = await Promise.all(
    ids.map(async (id) => {
      const conns = await loadConnections(id);
      return { id: String(id), conns };
    })
  );
  allConnections.forEach(({ id, conns }) => connByArtist.set(id, conns));

  return artists.map((artist) =>
    enrichOne(artist, metricsMap.get(String(artist._id)), connByArtist.get(String(artist._id)) || [])
  );
}

module.exports = {
  enrichArtistById,
  enrichAllArtists,
  enrichOne,
};
