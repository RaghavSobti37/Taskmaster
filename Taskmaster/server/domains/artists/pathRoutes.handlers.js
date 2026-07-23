const Person = require('../../models/Person');
const PersonIdentifier = require('../../models/PersonIdentifier');
const artistPathHubService = require('./services/artistPathHubService');
const { syncFromSheet } = require('./services/artistPathImportService');
const { mapRowToArtistPath } = require('../../../shared/artistPathSchema.cjs');

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
let lastResponseAutoSyncAt = 0;
let responseAutoSyncPromise = null;

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

async function maybeAutoSyncResponses({ search, page }) {
  if (process.env.NODE_ENV === 'test') return;
  if (search || page !== 1) return;
  const now = Date.now();
  if (now - lastResponseAutoSyncAt < AUTO_SYNC_INTERVAL_MS) return;
  if (!responseAutoSyncPromise) {
    responseAutoSyncPromise = syncFromSheet({ filename: 'artist_path_admin_auto_sync' })
      .catch(() => null)
      .finally(() => {
        lastResponseAutoSyncAt = Date.now();
        responseAutoSyncPromise = null;
      });
  }
  await responseAutoSyncPromise;
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

exports.listResponses = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    const query = {};
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { 'answers.name': re },
        { 'answers.email': re },
        { 'answers.phone': re },
        { 'answers.stageName': re },
        { 'answers.city': re },
        { 'rawRow.FullName': re },
        { 'rawRow.Email': re },
        { 'rawRow.Mobile': re },
        { 'rawRow.StageName': re },
        { 'rawRow.Place': re },
      ];
    }

    await maybeAutoSyncResponses({ search, page });

    const [total, rows] = await Promise.all([
      artistPathHubService.countResponses(query),
      artistPathHubService.listResponses(query, { skip, limit }),
    ]);

    const data = rows.map(enrichArtistPathResponse);
    res.json({ data, total, page, pages: Math.ceil(total / limit) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const [person, hub, identifiers, responses] = await Promise.all([
      Person.findById(personId).setOptions({ bypassTenant: true }).lean(),
      artistPathHubService.findHubByPersonId(personId),
      PersonIdentifier.find({ personId }).setOptions({ bypassTenant: true }).lean(),
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
