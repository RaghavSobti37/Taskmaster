const Artist = require('../../../models/Artist');
const ArtistAsset = require('../../../models/ArtistAsset');
const ArtistReleaseCampaign = require('../../../models/ArtistReleaseCampaign');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const ArtistContentRelease = require('../../../models/ArtistContentRelease');

const ASSET_FIELDS = ['type', 'title', 'url', 'tags'];
const RELEASE_FIELDS = ['title', 'releaseDate', 'dspLinks', 'distributor', 'upc', 'isrc', 'campaignNotes', 'contentReleaseId'];

function pickFields(body, fields) {
  const out = {};
  fields.forEach((key) => {
    if (body[key] !== undefined) out[key] = body[key];
  });
  return out;
}

function normalizeDspLinks(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((l) => l?.platform && l?.url);
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, url]) => url)
      .map(([platform, url]) => ({ platform, url: String(url) }));
  }
  return [];
}

async function requireArtist(artistId) {
  const artist = await Artist.findById(artistId).select('_id name').lean();
  if (!artist) {
    const err = new Error('Artist not found');
    err.statusCode = 404;
    throw err;
  }
  return artist;
}

function computeSpotifyDelta(history, releaseDate) {
  if (!history?.length || !releaseDate) return null;
  const relDate = new Date(releaseDate);
  const before = history.filter((h) => {
    const t = new Date(h.timestamp);
    return t >= new Date(relDate.getTime() - 14 * 86400000) && t < relDate;
  });
  const after = history.filter((h) => {
    const t = new Date(h.timestamp);
    return t >= relDate && t <= new Date(relDate.getTime() + 14 * 86400000);
  });
  const spBefore = before.at(-1)?.metrics?.spotify?.followers ?? null;
  const spAfter = after.at(-1)?.metrics?.spotify?.followers ?? spBefore;
  if (spBefore == null && spAfter == null) return null;
  return (spAfter || 0) - (spBefore || 0);
}

async function attachReleaseCorrelations(artistId, releases) {
  if (!releases.length) return releases;

  const [metrics, contentReleases] = await Promise.all([
    ArtistMetrics.findOne({ artistId }).select('analyticsHistory').lean(),
    ArtistContentRelease.find({ artistId }).select('title releaseDate spotifyStreams youtubeViews').lean(),
  ]);

  const history = metrics?.analyticsHistory || [];

  return releases.map((rel) => {
    const linked = rel.contentReleaseId
      ? contentReleases.find((c) => String(c._id) === String(rel.contentReleaseId))
      : contentReleases.find(
          (c) => c.title === rel.title && new Date(c.releaseDate).toDateString() === new Date(rel.releaseDate).toDateString(),
        );

    const spotifyDelta = computeSpotifyDelta(history, rel.releaseDate);
    const analytics = {
      spotifyDelta,
      spotifyStreams: linked?.spotifyStreams ?? null,
      youtubeViews: linked?.youtubeViews ?? null,
      hasCorrelation: spotifyDelta != null || linked != null,
    };

    return { ...rel, analytics };
  });
}

async function listAssets(artistId) {
  await requireArtist(artistId);
  return ArtistAsset.find({ artistId }).sort({ createdAt: -1 }).lean();
}

async function createAsset(artistId, body, user) {
  await requireArtist(artistId);
  return ArtistAsset.create({
    artistId,
    type: body.type,
    title: body.title,
    url: body.url,
    isPublic: !!body.isPublic,
    uploadedBy: user?._id,
    tags: body.tags || [],
  });
}

async function updateAsset(artistId, assetId, body) {
  await requireArtist(artistId);
  const doc = await ArtistAsset.findOneAndUpdate(
    { _id: assetId, artistId },
    { $set: pickFields(body, ASSET_FIELDS) },
    { returnDocument: 'after', runValidators: true },
  );
  if (!doc) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
}

async function deleteAsset(artistId, assetId) {
  await requireArtist(artistId);
  const doc = await ArtistAsset.findOneAndDelete({ _id: assetId, artistId });
  if (!doc) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
}

async function listReleaseCampaigns(artistId) {
  await requireArtist(artistId);
  const releases = await ArtistReleaseCampaign.find({ artistId }).sort({ releaseDate: -1 }).lean();
  return attachReleaseCorrelations(artistId, releases);
}

async function createReleaseCampaign(artistId, body) {
  await requireArtist(artistId);
  const doc = await ArtistReleaseCampaign.create({
    artistId,
    title: body.title,
    releaseDate: body.releaseDate,
    dspLinks: normalizeDspLinks(body.dspLinks),
    distributor: body.distributor,
    upc: body.upc,
    isrc: body.isrc,
    campaignNotes: body.campaignNotes,
    contentReleaseId: body.contentReleaseId,
  });
  const [enriched] = await attachReleaseCorrelations(artistId, [doc.toObject()]);
  return enriched;
}

async function updateReleaseCampaign(artistId, releaseId, body) {
  await requireArtist(artistId);
  const patch = pickFields(body, RELEASE_FIELDS);
  if (body.dspLinks !== undefined) patch.dspLinks = normalizeDspLinks(body.dspLinks);

  const doc = await ArtistReleaseCampaign.findOneAndUpdate(
    { _id: releaseId, artistId },
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  );
  if (!doc) {
    const err = new Error('Release not found');
    err.statusCode = 404;
    throw err;
  }
  const [enriched] = await attachReleaseCorrelations(artistId, [doc.toObject()]);
  return enriched;
}

async function deleteReleaseCampaign(artistId, releaseId) {
  await requireArtist(artistId);
  const doc = await ArtistReleaseCampaign.findOneAndDelete({ _id: releaseId, artistId });
  if (!doc) {
    const err = new Error('Release not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
}

module.exports = {
  requireArtist,
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  listReleaseCampaigns,
  createReleaseCampaign,
  updateReleaseCampaign,
  deleteReleaseCampaign,
  normalizeDspLinks,
  attachReleaseCorrelations,
};
