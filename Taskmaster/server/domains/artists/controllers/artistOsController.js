const artistOs = require('../services/artistOsService');
const { enrichArtistById } = require('../services/artistEnrichmentService');

const artistIdParam = (req) => req.params.id;

function sendOsError(res, err, fallbackStatus = 500) {
  const status = err.statusCode || err.status || fallbackStatus;
  const payload = { message: err.message };
  if (err.code) payload.code = err.code;
  res.status(status).json(payload);
}

function notImplemented(feature, hint) {
  return (_req, res) => {
    res.status(501).json({
      message: `${feature} is not implemented yet.`,
      code: 'NOT_IMPLEMENTED',
      hint,
    });
  };
}

exports.getOverview = async (req, res) => {
  try {
    const data = await artistOs.getOverview(artistIdParam(req));
    res.json(data);
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.getInquiries = async (req, res) => {
  try {
    const data = await artistOs.listInquiries(artistIdParam(req));
    res.json(data);
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createInquiry = async (req, res) => {
  try {
    const data = await artistOs.createInquiry(artistIdParam(req), req.body, req.user);
    res.status(201).json(data);
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.updateInquiry = async (req, res) => {
  try {
    const data = await artistOs.updateInquiry(artistIdParam(req), req.params.inquiryId, req.body);
    if (!data) return res.status(404).json({ message: 'Inquiry not found', code: 'INQUIRY_NOT_FOUND' });
    res.json(data);
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.getGigs = async (req, res) => {
  try {
    const data = await artistOs.listGigs(artistIdParam(req));
    res.json(data);
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createGig = async (req, res) => {
  try {
    const data = await artistOs.createGig(artistIdParam(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.updateGig = async (req, res) => {
  try {
    const data = await artistOs.updateGig(artistIdParam(req), req.params.gigId, req.body);
    if (!data) return res.status(404).json({ message: 'Gig not found', code: 'GIG_NOT_FOUND' });
    res.json(data);
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.getFinance = async (req, res) => {
  try {
    const data = await artistOs.listFinance(artistIdParam(req), req.query.month);
    res.json(data);
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createFinanceEntry = async (req, res) => {
  try {
    const data = await artistOs.createFinanceEntry(artistIdParam(req), req.body, req.user);
    res.status(201).json(data);
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.financeOcr = notImplemented(
  'Per-artist finance OCR',
  'Use org Finance OCR at /management?tab=finance.',
);

exports.getCalendar = async (req, res) => {
  try {
    const data = await artistOs.getCalendar(artistIdParam(req), req.query.from, req.query.to);
    res.json(data);
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createCalendarEvent = async (req, res) => {
  try {
    const doc = await artistOs.createCalendarEvent(artistIdParam(req), req.body);
    res.status(201).json(doc);
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.getTimeline = async (req, res) => {
  try {
    const data = await artistOs.getTimeline(artistIdParam(req));
    res.json(data);
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.getAnalyticsScores = async (req, res) => {
  try {
    const artistId = artistIdParam(req);
    await artistOs.requireArtist(artistId);
    const [overview, enriched] = await Promise.all([
      artistOs.getOverview(artistId),
      enrichArtistById(artistId),
    ]);
    const scores = artistOs.computeAnalyticsScores(enriched, overview);
    const correlations = await artistOs.getReleaseCorrelations(artistId);
    res.json({ scores, correlations, timeframe: req.query.timeframe });
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.getDemographics = notImplemented(
  'Platform demographics (age/gender)',
  'Requires extended Meta/YouTube API permissions.',
);

exports.getContracts = async (req, res) => {
  try {
    res.json(await artistOs.listContracts(artistIdParam(req)));
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createContract = async (req, res) => {
  try {
    res.status(201).json(await artistOs.createContract(artistIdParam(req), req.body));
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.getDocuments = async (req, res) => {
  try {
    res.json(await artistOs.listDocuments(artistIdParam(req)));
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createDocument = notImplemented(
  'Artist document vault upload',
  'Attach contract URLs via POST /os/contracts or use org Finance OCR.',
);

exports.getNotes = async (req, res) => {
  try {
    res.json(await artistOs.listNotes(artistIdParam(req)));
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createNote = async (req, res) => {
  try {
    res.status(201).json(await artistOs.createNote(artistIdParam(req), req.body, req.user));
  } catch (err) {
    sendOsError(res, err, 400);
  }
};

exports.getContent = async (req, res) => {
  try {
    res.json(await artistOs.listContent(artistIdParam(req)));
  } catch (err) {
    sendOsError(res, err);
  }
};

exports.createContent = async (req, res) => {
  try {
    res.status(201).json(await artistOs.createContent(artistIdParam(req), req.body));
  } catch (err) {
    sendOsError(res, err, 400);
  }
};
