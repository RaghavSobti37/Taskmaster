const ArtistPathResponse = require('../../../models/ArtistPathResponse');

async function loadArtistPathSection(contact) {
  const personId = contact.personId || contact._id;
  const responses = personId
    ? await ArtistPathResponse.find({ personId }).sort({ submittedAt: -1 }).lean()
    : [];
  return { section: 'artist_path', artistPath: { responses } };
}

module.exports = {
  loadArtistPathSection,
};
