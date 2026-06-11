const { buildWebinarQnaItems } = require('../../../../shared/leadWebinarQna.cjs');
const { mapRowToArtistPath } = require('../../../../shared/artistPathSchema.cjs');
const artistPathHubService = require('../../artists/services/artistPathHubService');

function enrichArtistPathResponse(doc) {
  if (!doc) return doc;
  const mapped = doc.rawRow && Object.keys(doc.rawRow).length
    ? mapRowToArtistPath(doc.rawRow)
    : null;
  const answers = {
    ...(mapped?.answers || {}),
    ...(doc.answers || {}),
    name: doc.answers?.name || mapped?.identity?.name,
    email: doc.answers?.email || mapped?.identity?.email,
    phone: doc.answers?.phone || mapped?.identity?.phone,
    city: doc.answers?.city || mapped?.identity?.city,
  };
  return {
    _id: doc._id,
    submittedAt: doc.submittedAt || mapped?.submittedAt || doc.createdAt,
    answers,
  };
}

async function enrichLeadDetail(lead) {
  if (!lead) return lead;

  lead.webinarQnaItems = buildWebinarQnaItems(lead);

  if (!lead.personId) {
    lead.artistPathResponses = [];
    return lead;
  }

  try {
    const raw = await artistPathHubService.listResponsesForPerson(lead.personId);
    lead.artistPathResponses = raw.map(enrichArtistPathResponse);
  } catch {
    lead.artistPathResponses = [];
  }

  return lead;
}

module.exports = {
  enrichLeadDetail,
  enrichArtistPathResponse,
};
