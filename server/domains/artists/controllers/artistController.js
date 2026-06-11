const Artist = require('../../../models/Artist');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const ArtistAuth = require('../../../models/ArtistAuth');
const ArtistConnection = require('../../../models/ArtistConnection');
const { enrichArtistById, enrichAllArtists } = require('../services/artistEnrichmentService');
const { upsertConnection } = require('../services/connectionService');
const { INTEGRATIONS } = require('../../../config/integrations.config');

exports.getArtists = async (req, res) => {
  try {
    const artists = await enrichAllArtists();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getArtistById = async (req, res) => {
  try {
    const artist = await enrichArtistById(req.params.id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getIntegrationsConfig = async (_req, res) => {
  res.json({ integrations: INTEGRATIONS });
};

exports.getArtistConnections = async (req, res) => {
  try {
    const artist = await enrichArtistById(req.params.id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    res.json({ connections: artist.connections, normalized: artist.normalized });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createArtist = async (req, res) => {
  try {
    const { name, bio, website, oauthCredentials, profileImage } = req.body;
    const artist = await Artist.create({
      name,
      bio: bio || `${name} official roster artist.`,
      website,
      profileImage: profileImage || '/hnd-posing.jpeg',
    });

    const creds = oauthCredentials || {};
    if (creds.spotify?.artistId) {
      await upsertConnection({
        artistId: artist._id,
        provider: 'spotify',
        accountHandle: creds.spotify.artistId,
        accountLabel: name,
        metadata: { artistId: creds.spotify.artistId },
      });
    }
    if (creds.youtube?.channelId) {
      await upsertConnection({
        artistId: artist._id,
        provider: 'youtube',
        accountHandle: creds.youtube.channelId,
        accountLabel: 'YouTube',
        metadata: { channelId: creds.youtube.channelId },
      });
    }
    if (creds.meta?.igAccountId) {
      await upsertConnection({
        artistId: artist._id,
        provider: 'instagram',
        accountHandle: creds.meta.igAccountId,
        accountLabel: 'Instagram',
        metadata: { igAccountId: creds.meta.igAccountId },
      });
    }

    await ArtistAuth.findOneAndUpdate(
      { artistId: artist._id },
      { $set: { isSynced: false } },
      { upsert: true }
    );

    const enriched = await enrichArtistById(artist._id);
    res.status(201).json(enriched);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateArtist = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    if (req.body.name !== undefined) artist.name = req.body.name;
    if (req.body.bio !== undefined) artist.bio = req.body.bio;
    if (req.body.profileImage !== undefined) artist.profileImage = req.body.profileImage;
    if (req.body.website !== undefined) artist.website = req.body.website;
    if (req.body.socials !== undefined) {
      artist.socials = { ...artist.socials, ...req.body.socials };
    }
    if (req.body.events !== undefined) artist.events = req.body.events;
    if (req.body.discography !== undefined) artist.discography = req.body.discography;

    await artist.save();

    if (req.body.oauthCredentials) {
      const creds = req.body.oauthCredentials;
      if (creds.spotify?.artistId !== undefined) {
        await upsertConnection({
          artistId: artist._id,
          provider: 'spotify',
          accountHandle: creds.spotify.artistId,
          accountLabel: artist.name,
          metadata: { artistId: creds.spotify.artistId },
        });
      }
      if (creds.youtube?.channelId !== undefined) {
        await upsertConnection({
          artistId: artist._id,
          provider: 'youtube',
          accountHandle: creds.youtube.channelId,
          metadata: { channelId: creds.youtube.channelId },
        });
      }
      if (creds.meta?.igAccountId !== undefined || creds.meta?.fbPageId !== undefined) {
        if (creds.meta.igAccountId !== undefined) {
          await upsertConnection({
            artistId: artist._id,
            provider: 'instagram',
            accountHandle: creds.meta.igAccountId,
            metadata: {
              igAccountId: creds.meta.igAccountId,
              fbPageId: creds.meta.fbPageId,
            },
          });
        }
        if (creds.meta.fbPageId !== undefined) {
          await upsertConnection({
            artistId: artist._id,
            provider: 'facebook',
            accountHandle: creds.meta.fbPageId,
            metadata: { fbPageId: creds.meta.fbPageId },
          });
        }
      }
    }

    if (req.body.trackedVideos !== undefined) {
      await ArtistMetrics.findOneAndUpdate(
        { artistId: artist._id },
        { $set: { trackedVideos: req.body.trackedVideos } },
        { upsert: true }
      );
    }

    const enriched = await enrichArtistById(artist._id);
    res.json(enriched);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteArtist = async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([
      Artist.findByIdAndDelete(id),
      ArtistMetrics.deleteMany({ artistId: id }),
      ArtistAuth.deleteMany({ artistId: id }),
      ArtistConnection.deleteMany({ artistId: id }),
    ]);
    res.json({ message: 'Artist deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.injectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = req.body;
    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    artist.events.unshift(event);
    await artist.save();
    const enriched = await enrichArtistById(id);
    res.status(201).json(enriched);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.setPrimaryConnection = async (req, res) => {
  try {
    const { id, connectionId } = req.params;
    const conn = await ArtistConnection.findOne({ _id: connectionId, artistId: id });
    if (!conn) return res.status(404).json({ message: 'Connection not found' });

    await ArtistConnection.updateMany(
      { artistId: id, provider: conn.provider },
      { $set: { isPrimary: false } }
    );
    conn.isPrimary = true;
    await conn.save();

    const enriched = await enrichArtistById(id);
    res.json(enriched);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
