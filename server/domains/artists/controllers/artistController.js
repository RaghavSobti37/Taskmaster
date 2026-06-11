const Artist = require('../../../models/Artist');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const ArtistAuth = require('../../../models/ArtistAuth');
const ArtistConnection = require('../../../models/ArtistConnection');
const { enrichArtistById, enrichAllArtists } = require('../services/artistEnrichmentService');
const { upsertConnection } = require('../services/connectionService');
const { createInquiry } = require('../services/artistOsService');
const { INTEGRATIONS, INTEGRATION_CATEGORIES } = require('../../../config/integrations.config');

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
  res.json({ integrations: INTEGRATIONS, categories: INTEGRATION_CATEGORIES });
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
    if (req.body.slug !== undefined) artist.slug = req.body.slug || undefined;
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

function buildPublicSocialLinks(artist, connections = []) {
  const links = {};
  const socials = artist.socials || {};
  if (socials.spotify) links.spotify = socials.spotify;
  if (socials.youtube) links.youtube = socials.youtube;
  if (socials.instagram) links.instagram = socials.instagram;
  if (socials.facebook) links.facebook = socials.facebook;
  if (socials.soundcloud) links.soundcloud = socials.soundcloud;
  if (artist.website) links.website = artist.website;

  connections.forEach((conn) => {
    if (!conn?.provider || conn.status === 'revoked') return;
    const handle = conn.accountHandle;
    if (!handle) return;
    if (conn.provider === 'spotify') links.spotify = `https://open.spotify.com/artist/${handle}`;
    if (conn.provider === 'youtube') links.youtube = `https://www.youtube.com/channel/${handle}`;
    if (conn.provider === 'instagram' && conn.metadata?.igUsername) {
      links.instagram = `https://www.instagram.com/${conn.metadata.igUsername.replace(/^@/, '')}`;
    }
  });

  return links;
}

function sanitizePublicEvents(events = []) {
  return events
    .filter((e) => e && e.status !== 'cancelled' && e.status !== 'private')
    .map(({ date, venue, title, description, status }) => ({
      date,
      venue,
      title,
      description,
      status,
    }));
}

exports.getPortfolioSummary = async (_req, res) => {
  try {
    const artists = await enrichAllArtists();
    let totalReach = 0;
    let totalFollowers = 0;
    let monthlyGrowthSum = 0;
    let growthCount = 0;
    let topPerformer = null;

    artists.forEach((artist) => {
      const unified = artist.normalized?.unified || {};
      const reach = Number(unified.reach) || 0;
      const growth = Number(unified.growth) || 0;
      totalReach += reach;
      totalFollowers += reach;
      if (Number.isFinite(growth)) {
        monthlyGrowthSum += growth;
        growthCount += 1;
      }
      if (!topPerformer || growth > (topPerformer.growth || 0)) {
        topPerformer = {
          artistId: artist._id,
          name: artist.name,
          growth,
          reach,
        };
      }
    });

    res.json({
      totalArtists: artists.length,
      totalReach,
      totalFollowers,
      monthlyGrowth: growthCount ? Number((monthlyGrowthSum / growthCount).toFixed(2)) : 0,
      topPerformer,
      connectedPlatforms: artists.reduce(
        (sum, a) => sum + (a.normalized?.unified?.connectedCount || 0),
        0
      ),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicArtistBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ message: 'Slug required' });

    const artist = await Artist.findOne({ slug }).lean();
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const enriched = await enrichArtistById(artist._id);
    const connections = (enriched?.connections || []).map(({ provider, accountLabel, accountHandle, status }) => ({
      provider,
      accountLabel,
      accountHandle,
      status,
    }));

    res.json({
      slug: artist.slug,
      name: artist.name,
      bio: artist.bio,
      profileImage: artist.profileImage,
      website: artist.website,
      socialLinks: buildPublicSocialLinks(artist, enriched?.connections || []),
      upcomingGigs: sanitizePublicEvents(artist.events || []),
      connections,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPublicInquiry = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ message: 'Slug required' });

    const artist = await Artist.findOne({ slug }).select('_id name').lean();
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const { clientName, email, phone, eventName, eventDate, expectedBudget, metadata } = req.body || {};
    if (!clientName) return res.status(400).json({ message: 'clientName is required' });

    const inquiry = await createInquiry(
      artist._id,
      {
        clientName,
        email,
        phone,
        eventName,
        eventDate,
        expectedBudget,
        metadata,
        source: 'public_profile',
      },
      null
    );

    res.status(201).json({
      message: 'Booking inquiry submitted',
      inquiryId: inquiry._id,
      artistName: artist.name,
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message });
  }
};
