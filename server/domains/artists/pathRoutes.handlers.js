const Person = require('../../models/Person');
const PersonIdentifier = require('../../models/PersonIdentifier');
const artistPathHubService = require('./services/artistPathHubService');
const { syncFromSheet } = require('./services/artistPathImportService');
const { mapRowToArtistPath } = require('../../../shared/artistPathSchema.cjs');

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
    ...doc,
    answers,
    submittedAt: doc.submittedAt || mapped?.submittedAt || doc.createdAt,
  };
}

function responseCompleteness(answers = {}) {
  return Object.values(answers).filter((v) => v != null && String(v).trim() !== '').length;
}

function sortResponsesForHub(responses, hubEmail) {
  const enriched = responses.map(enrichArtistPathResponse);
  const target = hubEmail?.toLowerCase();
  return enriched.sort((a, b) => {
    if (target) {
      const aMatch = (a.answers?.email || '').toLowerCase() === target ? 0 : 1;
      const bMatch = (b.answers?.email || '').toLowerCase() === target ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    const completenessDelta = responseCompleteness(b.answers) - responseCompleteness(a.answers);
    if (completenessDelta !== 0) return completenessDelta;
    return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
  });
}

exports.listPeople = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { inArtistPath: true };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: re }, { email: re }, { phone: re }];
    }

    const [total, data] = await Promise.all([
      artistPathHubService.countPeople(query),
      artistPathHubService.listPeople(query, { skip, limit }),
    ]);

    res.json({ data, total, page, pages: Math.ceil(total / limit) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const [person, hub, identifiers, responses] = await Promise.all([
      Person.findById(personId).lean(),
      artistPathHubService.findHubByPersonId(personId),
      PersonIdentifier.find({ personId }).lean(),
      artistPathHubService.listResponsesForPerson(personId),
    ]);
    if (!person && !hub) return res.status(404).json({ error: 'Person not found' });

    const email = identifiers.find((i) => i.type === 'email')?.valueNormalized
      || hub?.email
      || responses[0]?.answers?.email;
    const phone = identifiers.find((i) => i.type === 'phone')?.valueNormalized
      || hub?.phone
      || responses[0]?.answers?.phone;

    res.json({
      person,
      hub,
      identifiers,
      responses: sortResponsesForHub(responses, email),
      email,
      phone,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sync = async (req, res) => {
  try {
    const result = await syncFromSheet({ userId: req.user._id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
