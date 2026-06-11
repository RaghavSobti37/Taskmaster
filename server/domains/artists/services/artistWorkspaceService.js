const Artist = require('../../../models/Artist');
const ArtistAsset = require('../../../models/ArtistAsset');
const ArtistReleaseCampaign = require('../../../models/ArtistReleaseCampaign');

async function requireArtist(artistId) {
  const artist = await Artist.findById(artistId).select('_id name').lean();
  if (!artist) {
    const err = new Error('Artist not found');
    err.statusCode = 404;
    throw err;
  }
  return artist;
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
    uploadedBy: user?._id,
    tags: body.tags || [],
  });
}

async function listReleaseCampaigns(artistId) {
  await requireArtist(artistId);
  return ArtistReleaseCampaign.find({ artistId }).sort({ releaseDate: -1 }).lean();
}

async function createReleaseCampaign(artistId, body) {
  await requireArtist(artistId);
  return ArtistReleaseCampaign.create({
    artistId,
    title: body.title,
    releaseDate: body.releaseDate,
    dspLinks: body.dspLinks || [],
    distributor: body.distributor,
    campaignNotes: body.campaignNotes,
    contentReleaseId: body.contentReleaseId,
  });
}

module.exports = {
  requireArtist,
  listAssets,
  createAsset,
  listReleaseCampaigns,
  createReleaseCampaign,
};
