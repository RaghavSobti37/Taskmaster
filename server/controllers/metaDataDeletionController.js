const crypto = require('crypto');
const Artist = require('../models/Artist');
const ArtistConnection = require('../models/ArtistConnection');
const MetaDeletionRequest = require('../models/MetaDeletionRequest');
const { parseSignedRequest } = require('../utils/metaSignedRequest');
const { resolveClientUrl } = require('../utils/oauthEnv');
const logger = require('../utils/logger');

function generateConfirmationCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

async function purgeMetaDataForUser(metaUserId) {
  const connectionFilter = {
    provider: { $in: ['instagram', 'facebook', 'meta'] },
    $or: [
      { 'metadata.metaUserId': metaUserId },
      { 'metadata.facebookUserId': metaUserId },
    ],
  };

  const connections = await ArtistConnection.find(connectionFilter).select('artistId');
  const artistIds = [...new Set(connections.map((c) => String(c.artistId)))];

  const deleteResult = await ArtistConnection.deleteMany(connectionFilter);

  for (const artistId of artistIds) {
    await Artist.findByIdAndUpdate(artistId, {
      $unset: { 'oauthCredentials.meta': '' },
      $set: {
        'analytics.instagram': {},
        isSynced: false,
      },
    });
  }

  return { artistsAffected: artistIds.length, connectionsRemoved: deleteResult.deletedCount || 0 };
}

/** POST /api/webhooks/meta-data-deletion — Meta Platform data deletion callback */
exports.handleDataDeletionCallback = async (req, res) => {
  try {
    const appSecret = (process.env.META_APP_SECRET || '').replace(/['"]/g, '').trim();
    if (!appSecret || appSecret === 'ROTATED_PLEASE_UPDATE_IN_SECRETS_MANAGER') {
      return res.status(503).json({ error: 'META_APP_SECRET not configured' });
    }

    const signedRequest = req.body?.signed_request;
    if (!signedRequest) {
      return res.status(400).json({ error: 'Missing signed_request' });
    }

    const data = parseSignedRequest(signedRequest, appSecret);
    const metaUserId = data.user_id;
    if (!metaUserId) {
      return res.status(400).json({ error: 'Missing user_id in signed_request' });
    }

    const confirmationCode = generateConfirmationCode();
    const clientUrl = resolveClientUrl();

    const record = await MetaDeletionRequest.create({
      confirmationCode,
      metaUserId,
      status: 'pending',
    });

    try {
      const { artistsAffected, connectionsRemoved } = await purgeMetaDataForUser(metaUserId);
      record.status = 'completed';
      record.artistsAffected = artistsAffected;
      record.connectionsRemoved = connectionsRemoved;
      record.completedAt = new Date();
      await record.save();
      logger.info('metaDeletion', 'Meta user data purged', { metaUserId, artistsAffected, connectionsRemoved });
    } catch (purgeErr) {
      record.status = 'failed';
      record.errorMessage = purgeErr.message;
      await record.save();
      logger.error('metaDeletion', 'Purge failed', { metaUserId, error: purgeErr.message });
    }

    const statusUrl = `${clientUrl}/userdata?code=${encodeURIComponent(confirmationCode)}`;

    return res.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    logger.error('metaDeletion', 'Callback error', { error: err.message });
    return res.status(400).json({ error: err.message });
  }
};

/** GET /api/webhooks/meta-data-deletion/:code — public deletion status (for Meta compliance) */
exports.getDeletionStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const record = await MetaDeletionRequest.findOne({ confirmationCode: code }).lean();
    if (!record) {
      return res.status(404).json({ status: 'not_found', message: 'Deletion request not found' });
    }

    return res.json({
      confirmation_code: record.confirmationCode,
      status: record.status,
      meta_user_id: record.metaUserId,
      artists_affected: record.artistsAffected,
      connections_removed: record.connectionsRemoved,
      completed_at: record.completedAt,
      created_at: record.createdAt,
      error: record.errorMessage || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports.purgeMetaDataForUser = purgeMetaDataForUser;
