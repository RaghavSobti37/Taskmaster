const jwt = require('jsonwebtoken');
const Artist = require('../../../models/Artist');
const User = require('../../../models/User');
const { enrichArtistById } = require('../services/artistEnrichmentService');
const {
  createArtistMembership,
  ensureUserOnArtistTeam,
  serializeMembership,
} = require('../services/artistMembershipService');
const logger = require('../../../utils/logger');

const SHARE_EXPIRY = process.env.ARTIST_SHARE_TOKEN_EXPIRES || '7d';

function generateShareToken(artistId) {
  return jwt.sign(
    { artistId, purpose: 'artist_share' },
    process.env.JWT_SECRET,
    { expiresIn: SHARE_EXPIRY }
  );
}

function verifyShareToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.purpose !== 'artist_share') throw new Error('Invalid share token');
  return decoded;
}

/** POST /api/artists/:id/share-link */
exports.createShareLink = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const token = generateShareToken(artist._id);
    const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const url = `${base}/preview/artist/${artist._id}?token=${token}`;

    res.json({ url, token, expiresIn: SHARE_EXPIRY });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/artists/:id/preview?token= — public read with share token */
exports.getArtistPreview = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(401).json({ message: 'Share token required' });

    const { artistId } = verifyShareToken(token);
    if (String(artistId) !== String(req.params.id)) {
      return res.status(403).json({ message: 'Token does not match artist' });
    }

    const enriched = await enrichArtistById(artistId);
    if (!enriched) return res.status(404).json({ message: 'Artist not found' });

    res.json({ ...enriched, shareMode: true });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired share link' });
  }
};

/** POST /api/artists/:id/claim — create artist-owner ArtistMembership + legacy team[] */
exports.claimArtistWorkspace = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Share token required' });

    const { artistId } = verifyShareToken(token);
    if (String(artistId) !== String(req.params.id)) {
      return res.status(403).json({ message: 'Token does not match artist' });
    }

    // Claim links may arrive before tenant context matches artist record (share preview flow).
    let artist = await Artist.findById(artistId);
    if (!artist) {
      artist = await Artist.findById(artistId).setOptions({ bypassTenant: true });
    }
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const userId = req.user._id;
    await ensureUserOnArtistTeam(artistId, userId);

    const membership = await createArtistMembership({
      artistId,
      userId,
      role: 'artist-owner',
      invitedBy: userId,
      acceptedAt: new Date(),
      status: 'accepted',
    });

    try {
      const Lead = require('../../../models/Lead');
      await Lead.updateMany(
        { 'customFields.artistId': String(artistId) },
        { $set: { status: 'active', owner: userId, 'customFields.claimedAt': new Date() } }
      );
    } catch (crmErr) {
      logger.warn('artistShare', 'CRM claim sync skipped', { error: crmErr.message });
    }

    const enriched = await enrichArtistById(artistId);
    const redirectUrl = `/artist-workspace/${artistId}`;
    res.json({
      success: true,
      artist: enriched,
      redirectUrl,
      membership: serializeMembership(membership.toObject?.() || membership),
      message: 'Workspace claimed successfully',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports.generateShareToken = generateShareToken;
module.exports.verifyShareToken = verifyShareToken;
