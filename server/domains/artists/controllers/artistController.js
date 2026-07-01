const { startOfDay } = require('date-fns');
const Artist = require('../../../models/Artist');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const ArtistAuth = require('../../../models/ArtistAuth');
const ArtistConnection = require('../../../models/ArtistConnection');
const ArtistFinanceEntry = require('../../../models/ArtistFinanceEntry');
const ArtistInquiry = require('../../../models/ArtistInquiry');
const ArtistGig = require('../../../models/ArtistGig');
const ArtistAsset = require('../../../models/ArtistAsset');
const ArtistReleaseCampaign = require('../../../models/ArtistReleaseCampaign');
const ArtistSocialProfile = require('../../../models/ArtistSocialProfile');
const { enrichArtistById, enrichAllArtists } = require('../services/artistEnrichmentService');
const { upsertConnection } = require('../services/connectionService');
const { createInquiry } = require('../services/artistOsService');
const { INTEGRATIONS, INTEGRATION_CATEGORIES } = require('../../../config/integrations.config');

const PENDING_INQUIRY_STATUSES = ['new', 'contacted', 'negotiating', 'blocked'];
const STALE_SYNC_MS = 30 * 24 * 60 * 60 * 1000;

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function spotifyStreams(analytics = {}) {
  const sp = analytics.spotify || {};
  if (sp.streams != null && Number.isFinite(Number(sp.streams))) return Number(sp.streams);
  if (sp.totalStreams != null && Number.isFinite(Number(sp.totalStreams))) return Number(sp.totalStreams);
  if (sp.monthlyListeners && sp.streamsPerListener) {
    return Number(sp.monthlyListeners) * Number(sp.streamsPerListener);
  }
  return 0;
}

function topNBy(roster, key, limit = 5, minValue = 0) {
  return [...roster]
    .filter((row) => (row[key] || 0) > minValue)
    .sort((a, b) => (b[key] || 0) - (a[key] || 0))
    .slice(0, limit);
}

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

function parsePublicDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizePublicGigs(events = [], gigs = []) {
  const todayStart = startOfDay(new Date());
  const rows = [];

  events.forEach((event) => {
    if (!event || event.status === 'cancelled' || event.status === 'private') return;
    const date = parsePublicDate(event.date);
    if (date && startOfDay(date) < todayStart) return;
    rows.push({
      date: event.date,
      venue: event.venue || 'TBA',
    });
  });

  gigs.forEach((gig) => {
    const date = parsePublicDate(gig.gigDate);
    if (!date || startOfDay(date) < todayStart) return;
    rows.push({
      date: gig.gigDate,
      venue: gig.location || 'TBA',
    });
  });

  return rows.sort((a, b) => {
    const da = parsePublicDate(a.date)?.getTime() || 0;
    const db = parsePublicDate(b.date)?.getTime() || 0;
    return da - db;
  });
}

function buildMusicLinks(artist, releases = [], connections = []) {
  const links = [];
  const seen = new Set();

  const push = (label, platform, url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ label: label || platform, platform, url });
  };

  (artist.discography || []).forEach((item) => {
    if (item.spotify) push(item.title, 'spotify', item.spotify);
    if (item.youtube) push(item.title, 'youtube', item.youtube);
  });

  releases.forEach((release) => {
    (release.dspLinks || []).forEach((dsp) => push(release.title, dsp.platform, dsp.url));
  });

  connections.forEach((conn) => {
    if (!conn?.provider || conn.status === 'revoked') return;
    const handle = conn.accountHandle;
    if (!handle) return;
    if (conn.provider === 'spotify') push(artist.name, 'spotify', `https://open.spotify.com/artist/${handle}`);
    if (conn.provider === 'youtube') push('YouTube', 'youtube', `https://www.youtube.com/channel/${handle}`);
    if (conn.provider === 'soundcloud') push('SoundCloud', 'soundcloud', handle.startsWith('http') ? handle : `https://soundcloud.com/${handle}`);
  });

  return links;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

exports.getPortfolioSummary = async (_req, res) => {
  try {
    const artists = await enrichAllArtists();
    const artistIds = artists.map((a) => a._id);
    const { start, end } = monthBounds();
    const staleCutoff = new Date(Date.now() - STALE_SYNC_MS);

    const [
      financeRows,
      pendingInquiryAgg,
      inquiryTotalAgg,
      gigTotalAgg,
      connections,
    ] = await Promise.all([
      artistIds.length
        ? ArtistFinanceEntry.find({
          artistId: { $in: artistIds },
          entryDate: { $gte: start, $lte: end },
          type: 'revenue',
        }).lean()
        : [],
      artistIds.length
        ? ArtistInquiry.aggregate([
          {
            $match: {
              artistId: { $in: artistIds },
              status: { $in: PENDING_INQUIRY_STATUSES },
            },
          },
          { $group: { _id: '$artistId', count: { $sum: 1 } } },
        ])
        : [],
      artistIds.length
        ? ArtistInquiry.aggregate([
          { $match: { artistId: { $in: artistIds } } },
          { $group: { _id: '$artistId', count: { $sum: 1 } } },
        ])
        : [],
      artistIds.length
        ? ArtistGig.aggregate([
          { $match: { artistId: { $in: artistIds } } },
          { $group: { _id: '$artistId', count: { $sum: 1 } } },
        ])
        : [],
      artistIds.length
        ? ArtistConnection.find({ artistId: { $in: artistIds } })
          .select('artistId provider status lastSyncedAt')
          .lean()
        : [],
    ]);

    const revenueByArtist = new Map();
    financeRows.forEach((entry) => {
      const key = String(entry.artistId);
      revenueByArtist.set(key, (revenueByArtist.get(key) || 0) + (entry.amount || 0));
    });

    const pendingByArtist = new Map(pendingInquiryAgg.map((row) => [String(row._id), row.count]));
    const inquiryTotalByArtist = new Map(inquiryTotalAgg.map((row) => [String(row._id), row.count]));
    const gigTotalByArtist = new Map(gigTotalAgg.map((row) => [String(row._id), row.count]));

    const connectionsByArtist = new Map();
    connections.forEach((conn) => {
      const key = String(conn.artistId);
      if (!connectionsByArtist.has(key)) connectionsByArtist.set(key, []);
      connectionsByArtist.get(key).push(conn);
    });

    let totalReach = 0;
    let totalFollowers = 0;
    let totalStreams = 0;
    let monthlyGrowthSum = 0;
    let growthCount = 0;
    let totalRevenueMtd = 0;
    let totalBookings = 0;

    const roster = artists.map((artist) => {
      const id = String(artist._id);
      const unified = artist.normalized?.unified || {};
      const reach = Number(unified.reach) || 0;
      const growth = Number(unified.growth) || 0;
      const engagement = Number(unified.engagementRate) || 0;
      const streams = spotifyStreams(artist.analytics);
      const revenue = revenueByArtist.get(id) || 0;
      const inquiries = inquiryTotalByArtist.get(id) || 0;
      const gigs = gigTotalByArtist.get(id) || 0;

      totalReach += reach;
      totalFollowers += reach;
      totalStreams += streams;
      totalRevenueMtd += revenue;
      totalBookings += inquiries + gigs;

      if (Number.isFinite(growth)) {
        monthlyGrowthSum += growth;
        growthCount += 1;
      }

      return {
        artistId: artist._id,
        name: artist.name,
        growth,
        engagement,
        reach,
        revenue,
        streams,
        bookings: inquiries + gigs,
      };
    });

    const alerts = [];

    artists.forEach((artist) => {
      const id = String(artist._id);
      const artistConns = connectionsByArtist.get(id) || [];
      const expired = artistConns.filter((c) => c.status === 'expired' || c.status === 'revoked');
      if (expired.length) {
        alerts.push({
          type: 'expired_oauth',
          severity: 'warning',
          artistId: artist._id,
          artistName: artist.name,
          count: expired.length,
          providers: expired.map((c) => c.provider),
          message: `${artist.name} has ${expired.length} expired connection(s)`,
        });
      }

      const pending = pendingByArtist.get(id) || 0;
      if (pending > 5) {
        alerts.push({
          type: 'pending_inquiries',
          severity: 'warning',
          artistId: artist._id,
          artistName: artist.name,
          count: pending,
          message: `${artist.name} has ${pending} pending inquiries`,
        });
      }

      const activeConns = artistConns.filter((c) => c.status === 'active');
      if (activeConns.length) {
        const latestSync = activeConns.reduce((max, conn) => {
          const ts = conn.lastSyncedAt ? new Date(conn.lastSyncedAt).getTime() : 0;
          return Math.max(max, ts);
        }, 0);
        if (!latestSync || new Date(latestSync) < staleCutoff) {
          alerts.push({
            type: 'stale_sync',
            severity: 'info',
            artistId: artist._id,
            artistName: artist.name,
            lastSync: latestSync ? new Date(latestSync).toISOString() : null,
            message: `${artist.name} has not synced in 30+ days`,
          });
        }
      }
    });

    const topPerformer = topNBy(roster, 'growth', 1)[0] || null;

    res.json({
      totalArtists: artists.length,
      totalReach,
      totalFollowers,
      totalStreams,
      monthlyGrowth: growthCount ? Number((monthlyGrowthSum / growthCount).toFixed(2)) : 0,
      totalRevenueMtd,
      totalBookings,
      topPerformer,
      rankings: {
        topGrowth: topNBy(roster, 'growth'),
        topRevenue: topNBy(roster, 'revenue'),
        topEngagement: topNBy(roster, 'engagement'),
      },
      alerts,
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
    const sanitizedConnections = enriched?.connections || [];

    const [socialProfiles, upcomingGigs, pressAsset, releases] = await Promise.all([
      ArtistSocialProfile.find({ artistId: artist._id, status: { $in: ['connected', 'manual'] } }).lean(),
      ArtistGig.find({ artistId: artist._id, gigDate: { $gte: new Date() } }).sort({ gigDate: 1 }).limit(12).lean(),
      ArtistAsset.findOne({
        artistId: artist._id,
        isPublic: true,
        type: { $in: ['press', 'epk'] },
      }).sort({ createdAt: -1 }).lean(),
      ArtistReleaseCampaign.find({ artistId: artist._id }).sort({ releaseDate: -1 }).limit(8).lean(),
    ]);

    const socialLinks = buildPublicSocialLinks(artist, sanitizedConnections);
    socialProfiles.forEach((profile) => {
      if (!profile.platform || !profile.accountName) return;
      const name = profile.accountName.replace(/^@/, '');
      if (profile.platform === 'instagram' && !socialLinks.instagram) {
        socialLinks.instagram = `https://www.instagram.com/${name}`;
      }
      if (profile.platform === 'youtube' && !socialLinks.youtube) {
        socialLinks.youtube = profile.metadata?.channelUrl || `https://www.youtube.com/@${name}`;
      }
      if (profile.platform === 'spotify' && !socialLinks.spotify && profile.accountId) {
        socialLinks.spotify = `https://open.spotify.com/artist/${profile.accountId}`;
      }
    });

    const connections = sanitizedConnections.map(({ provider, accountLabel, accountHandle, status }) => ({
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
      socialLinks,
      musicLinks: buildMusicLinks(artist, releases, sanitizedConnections),
      pressKitUrl: pressAsset?.url || null,
      pressKitTitle: pressAsset?.title || null,
      upcomingGigs: sanitizePublicGigs(artist.events || [], upcomingGigs),
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
    const trimmedName = String(clientName || '').trim();
    const trimmedEmail = String(email || '').trim();
    const trimmedPhone = String(phone || '').trim();

    if (!trimmedName) return res.status(400).json({ message: 'Your name is required' });
    if (!trimmedEmail && !trimmedPhone) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (eventDate) {
      const parsed = new Date(eventDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: 'Enter a valid event date' });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed < today) {
        return res.status(400).json({ message: 'Event date cannot be in the past' });
      }
    }
    if (expectedBudget != null && expectedBudget !== '' && Number(expectedBudget) < 0) {
      return res.status(400).json({ message: 'Budget cannot be negative' });
    }

    const inquiry = await createInquiry(
      artist._id,
      {
        clientName: trimmedName,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
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
