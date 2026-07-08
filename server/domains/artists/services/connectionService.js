const ArtistConnection = require('../../../models/ArtistConnection');
const ArtistAuth = require('../../../models/ArtistAuth');
const { encrypt, decrypt } = require('../../../utils/encryption');

function packTokenData({ accessToken, refreshToken, expiresAt }) {
  if (!accessToken && !refreshToken) return null;
  const payload = JSON.stringify({
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
  });
  try {
    return encrypt(payload);
  } catch {
    return `plain:${payload}`;
  }
}

function unpackTokenData(encrypted) {
  if (!encrypted) return { accessToken: null, refreshToken: null, expiresAt: null };
  try {
    if (String(encrypted).startsWith('plain:')) {
      return JSON.parse(String(encrypted).slice(6));
    }
    const raw = decrypt(encrypted);
    if (!raw) return { accessToken: null, refreshToken: null, expiresAt: null };
    return JSON.parse(raw);
  } catch {
    return { accessToken: null, refreshToken: null, expiresAt: null };
  }
}

function sanitizeConnection(conn) {
  if (!conn) return null;
  const obj = conn.toObject ? conn.toObject() : { ...conn };
  delete obj.tokenData;
  return {
    _id: obj._id,
    artistId: obj.artistId,
    provider: obj.provider,
    accountHandle: obj.accountHandle,
    accountLabel: obj.accountLabel,
    status: obj.status,
    isPrimary: obj.isPrimary,
    metadata: obj.metadata || {},
    lastSyncedAt: obj.lastSyncedAt,
    lastError: obj.lastError,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function buildLegacyOAuthShape(connections) {
  const shape = { spotify: {}, youtube: {}, meta: {} };
  for (const c of connections) {
    const tokens = c._tokens || {};
    if (c.provider === 'spotify') {
      shape.spotify = {
        artistId: c.accountHandle || c.metadata?.artistId || '',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiresAt,
        displayName: c.accountLabel || c.metadata?.displayName,
        spotifyUserId: c.metadata?.spotifyUserId,
        connectedAt: c.createdAt,
      };
    }
    if (c.provider === 'youtube') {
      shape.youtube = {
        channelId: c.accountHandle || c.metadata?.channelId || '',
        channelTitle: c.accountLabel || c.metadata?.channelTitle,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiresAt,
        connectedAt: c.createdAt,
      };
    }
    if (c.provider === 'instagram' || c.provider === 'meta') {
      shape.meta = {
        ...shape.meta,
        accessToken: tokens.accessToken || shape.meta.accessToken,
        igAccountId: c.provider === 'instagram' ? c.accountHandle : (shape.meta.igAccountId || c.metadata?.igAccountId),
        fbPageId: c.metadata?.fbPageId || shape.meta.fbPageId,
        tokenExpiry: tokens.expiresAt,
        availableAccounts: c.metadata?.availableAccounts || shape.meta.availableAccounts || [],
        igUsername: c.metadata?.igUsername || shape.meta.igUsername,
      };
    }
    if (c.provider === 'facebook') {
      shape.meta = {
        ...shape.meta,
        fbPageId: c.accountHandle || c.metadata?.fbPageId,
        fbPageName: c.accountLabel || c.metadata?.fbPageName,
      };
    }
  }
  return shape;
}

async function getConnectionsForArtist(artistId, { includeTokens = false } = {}) {
  const query = ArtistConnection.find({ artistId });
  if (includeTokens) query.select('+tokenData');
  const rows = await query.lean();
  return rows.map((row) => {
    const tokens = includeTokens ? unpackTokenData(row.tokenData) : {};
    return { ...row, _tokens: tokens };
  });
}

async function getConnectionsForArtists(artistIds, { includeTokens = false } = {}) {
  const map = new Map();
  if (!artistIds?.length) return map;

  for (const id of artistIds) {
    map.set(String(id), []);
  }

  const query = ArtistConnection.find({ artistId: { $in: artistIds } });
  if (includeTokens) query.select('+tokenData');
  const rows = await query.lean();

  for (const row of rows) {
    const key = String(row.artistId);
    const tokens = includeTokens ? unpackTokenData(row.tokenData) : {};
    const list = map.get(key) || [];
    list.push({ ...row, _tokens: tokens });
    map.set(key, list);
  }

  return map;
}

async function upsertConnection({
  artistId,
  provider,
  accountHandle,
  accountLabel,
  status = 'active',
  isPrimary = true,
  accessToken,
  refreshToken,
  expiresAt,
  metadata = {},
}) {
  const tokenData = packTokenData({ accessToken, refreshToken, expiresAt });
  return ArtistConnection.findOneAndUpdate(
    { artistId, provider, accountHandle: accountHandle || '' },
    {
      $set: {
        artistId,
        provider,
        accountHandle: accountHandle || '',
        accountLabel: accountLabel || '',
        status,
        isPrimary,
        tokenData,
        metadata,
        lastError: null,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
}

async function getCredentialsForSync(artistId) {
  const Artist = require('../../../models/Artist');
  let connections = await getConnectionsForArtist(artistId, { includeTokens: true });

  if (connections.length === 0) {
    const auth = await ArtistAuth.findOne({ artistId }).lean();
    if (auth?.oauthCredentials) {
      await migrateAuthDocToConnections(artistId, auth);
      connections = await getConnectionsForArtist(artistId, { includeTokens: true });
    }
  }

  const shape = buildLegacyOAuthShape(connections);

  // Merge legacy embedded oauth from artist document (tokens + IDs)
  const raw = await Artist.collection.findOne({ _id: artistId });
  const legacy = raw?.oauthCredentials;
  if (legacy) {
    if (legacy.spotify) {
      shape.spotify = {
        artistId: shape.spotify.artistId || legacy.spotify.artistId || '',
        accessToken: shape.spotify.accessToken || legacy.spotify.accessToken,
        refreshToken: shape.spotify.refreshToken || legacy.spotify.refreshToken,
        tokenExpiry: shape.spotify.tokenExpiry || legacy.spotify.tokenExpiry,
        displayName: shape.spotify.displayName || legacy.spotify.displayName,
      };
    }
    if (legacy.youtube) {
      shape.youtube = {
        channelId: shape.youtube.channelId || legacy.youtube.channelId || '',
        channelTitle: shape.youtube.channelTitle || legacy.youtube.channelTitle,
        accessToken: shape.youtube.accessToken || legacy.youtube.accessToken,
        refreshToken: shape.youtube.refreshToken || legacy.youtube.refreshToken,
        tokenExpiry: shape.youtube.tokenExpiry || legacy.youtube.tokenExpiry,
      };
    }
    if (legacy.meta) {
      shape.meta = {
        igAccountId: shape.meta.igAccountId || legacy.meta.igAccountId || '',
        fbPageId: shape.meta.fbPageId || legacy.meta.fbPageId || '',
        accessToken: shape.meta.accessToken || legacy.meta.accessToken,
        tokenExpiry: shape.meta.tokenExpiry || legacy.meta.tokenExpiry,
        igUsername: shape.meta.igUsername || legacy.meta.igUsername,
        availableAccounts: shape.meta.availableAccounts?.length ? shape.meta.availableAccounts : (legacy.meta.availableAccounts || []),
        fbPageName: shape.meta.fbPageName || legacy.meta.fbPageName,
      };
    }
  }

  return shape;
}

async function migrateAuthDocToConnections(artistId, authDoc) {
  const oauth = authDoc.oauthCredentials || {};
  const created = [];

  if (oauth.spotify?.artistId || oauth.spotify?.accessToken) {
    created.push(await upsertConnection({
      artistId,
      provider: 'spotify',
      accountHandle: oauth.spotify.artistId || '',
      accountLabel: oauth.spotify.displayName || 'Spotify',
      accessToken: oauth.spotify.accessToken,
      refreshToken: oauth.spotify.refreshToken,
      expiresAt: oauth.spotify.tokenExpiry,
      metadata: {
        artistId: oauth.spotify.artistId,
        displayName: oauth.spotify.displayName,
        spotifyUserId: oauth.spotify.spotifyUserId,
        spotifyUri: oauth.spotify.spotifyUri,
      },
    }));
  }

  if (oauth.youtube?.channelId || oauth.youtube?.accessToken) {
    created.push(await upsertConnection({
      artistId,
      provider: 'youtube',
      accountHandle: oauth.youtube.channelId || '',
      accountLabel: oauth.youtube.channelTitle || 'YouTube',
      accessToken: oauth.youtube.accessToken,
      refreshToken: oauth.youtube.refreshToken,
      expiresAt: oauth.youtube.tokenExpiry,
      metadata: {
        channelId: oauth.youtube.channelId,
        channelTitle: oauth.youtube.channelTitle,
      },
    }));
  }

  if (oauth.meta?.igAccountId || oauth.meta?.accessToken) {
    created.push(await upsertConnection({
      artistId,
      provider: 'instagram',
      accountHandle: oauth.meta.igAccountId || '',
      accountLabel: oauth.meta.igUsername ? `@${oauth.meta.igUsername}` : 'Instagram',
      accessToken: oauth.meta.accessToken,
      refreshToken: null,
      expiresAt: oauth.meta.tokenExpiry,
      metadata: {
        igAccountId: oauth.meta.igAccountId,
        fbPageId: oauth.meta.fbPageId,
        igUsername: oauth.meta.igUsername,
        availableAccounts: oauth.meta.availableAccounts || [],
      },
    }));
    if (oauth.meta.fbPageId) {
      const fbAcc = (oauth.meta.availableAccounts || []).find((a) => a.fbPageId === oauth.meta.fbPageId);
      created.push(await upsertConnection({
        artistId,
        provider: 'facebook',
        accountHandle: oauth.meta.fbPageId,
        accountLabel: fbAcc?.fbPageName || 'Facebook Page',
        accessToken: oauth.meta.accessToken,
        expiresAt: oauth.meta.tokenExpiry,
        metadata: { fbPageId: oauth.meta.fbPageId, fbPageName: fbAcc?.fbPageName },
      }));
    }
  }

  return created;
}

async function migrateAllFromArtistAuth() {
  const auths = await ArtistAuth.find().lean();
  let count = 0;
  for (const auth of auths) {
    const existing = await ArtistConnection.countDocuments({ artistId: auth.artistId });
    if (existing > 0) continue;
    await migrateAuthDocToConnections(auth.artistId, auth);
    count += 1;
  }
  return count;
}

module.exports = {
  packTokenData,
  unpackTokenData,
  sanitizeConnection,
  buildLegacyOAuthShape,
  getConnectionsForArtist,
  getConnectionsForArtists,
  upsertConnection,
  getCredentialsForSync,
  migrateAuthDocToConnections,
  migrateAllFromArtistAuth,
};
