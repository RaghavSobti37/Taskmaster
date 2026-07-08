const mongoose = require('mongoose');
const Artist = require('../../../models/Artist');
const ArtistInquiry = require('../../../models/ArtistInquiry');
const ArtistGig = require('../../../models/ArtistGig');
const ArtistFinanceEntry = require('../../../models/ArtistFinanceEntry');
const ArtistCalendarEvent = require('../../../models/ArtistCalendarEvent');
const ArtistContract = require('../../../models/ArtistContract');
const ArtistTeamNote = require('../../../models/ArtistTeamNote');
const ArtistContentRelease = require('../../../models/ArtistContentRelease');
const ArtistActivityLog = require('../../../models/ArtistActivityLog');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const { enrichArtistById } = require('./artistEnrichmentService');
const { resolveProjectNameFromArtist } = require('../../../utils/artistEnquiryProjectResolver');

const EVENT_COLOR = {
  inquiry: 'inquiry',
  negotiating: 'inquiry',
  blocked: 'inquiry',
  gig: 'gig',
  confirmed: 'gig',
  dead: 'dead',
  personal: 'personal',
  release: 'release',
};

function artistNotFoundError() {
  const err = new Error('Artist not found');
  err.statusCode = 404;
  err.code = 'ARTIST_NOT_FOUND';
  return err;
}

async function requireArtist(artistId) {
  if (!mongoose.Types.ObjectId.isValid(artistId)) throw artistNotFoundError();
  const exists = await Artist.findById(artistId).select('_id').lean();
  if (!exists) throw artistNotFoundError();
}

async function logActivity(artistId, action, label, entityType, entityId, metadata = {}) {
  await ArtistActivityLog.create({
    artistId,
    action,
    label,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    metadata,
  });
}

async function resolveArtistIdFromEnquiryName(artistName) {
  if (!artistName) return null;
  const normalized = String(artistName).trim();
  const projectName = resolveProjectNameFromArtist(normalized);

  const candidates = [normalized, projectName].filter(Boolean);
  for (const name of candidates) {
    const exact = await Artist.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
    if (exact) return exact._id;
  }
  for (const name of candidates) {
    const partial = await Artist.findOne({ name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).lean();
    if (partial) return partial._id;
  }
  return null;
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function parseBudgetFromText(text) {
  if (!text) return 0;
  const match = String(text).replace(/,/g, '').match(/(\d{4,})/);
  return match ? Number(match[1]) : 0;
}

function computeAnalyticsScores(enriched, overviewFinance) {
  const unified = enriched?.normalized?.unified || {};
  const analytics = enriched?.analytics || {};
  const reach = unified.reach || 0;
  const growth = Number(unified.growth) || 0;
  const engagement = Number(analytics.instagram?.engagementRate) || 0;
  const profit = overviewFinance?.profitMtd || 0;
  const revenue = overviewFinance?.revenueMtd || 0;

  const audienceScore = Math.min(100, Math.round(Math.log10(Math.max(reach, 1)) * 20));
  const growthScore = Math.min(100, Math.max(0, Math.round(50 + growth * 2)));
  const engagementScore = Math.min(100, Math.round(engagement * 5));
  const monetizationScore = revenue > 0
    ? Math.min(100, Math.round((profit / revenue) * 100))
    : 0;

  return {
    audienceScore,
    growthScore,
    engagementScore,
    monetizationScore,
    growthPct: growth,
  };
}

function sliceHistoryByTimeframe(history, timeframe) {
  if (!history?.length || timeframe === 'ALL') return history;
  const now = new Date();
  const daysMap = { '7D': 7, '28D': 28, '90D': 90, YTD: null };
  let from = new Date(now);
  if (timeframe === 'YTD') {
    from = new Date(now.getFullYear(), 0, 1);
  } else {
    const days = daysMap[timeframe] || 28;
    from.setDate(from.getDate() - days);
  }
  return history.filter((h) => new Date(h.timestamp || h.date) >= from);
}

async function getOverview(artistId) {
  await requireArtist(artistId);
  const { start, end } = monthBounds();
  const now = new Date();

  const [financeEntries, upcomingGigs, pendingInquiries, confirmedShows, enriched] = await Promise.all([
    ArtistFinanceEntry.find({ artistId, entryDate: { $gte: start, $lte: end } }).lean(),
    ArtistGig.countDocuments({ artistId, gigDate: { $gte: now } }),
    ArtistInquiry.countDocuments({ artistId, status: { $in: ['new', 'contacted', 'negotiating', 'blocked'] } }),
    ArtistGig.countDocuments({ artistId, gigDate: { $gte: start } }),
    enrichArtistById(artistId),
  ]);

  let revenueMtd = 0;
  let expensesMtd = 0;
  financeEntries.forEach((e) => {
    if (e.type === 'revenue') revenueMtd += e.amount;
    else expensesMtd += e.amount;
  });

  return {
    revenueMtd,
    expensesMtd,
    profitMtd: revenueMtd - expensesMtd,
    upcomingShows: upcomingGigs,
    pendingInquiries,
    confirmedShows,
    normalized: enriched?.normalized,
    analytics: enriched?.analytics,
    scores: computeAnalyticsScores(enriched, { revenueMtd, expensesMtd, profitMtd: revenueMtd - expensesMtd }),
  };
}

async function listInquiries(artistId) {
  await requireArtist(artistId);
  return ArtistInquiry.find({ artistId }).sort({ createdAt: -1 }).lean();
}

async function createInquiry(artistId, body, user) {
  await requireArtist(artistId);
  const doc = await ArtistInquiry.create({
    artistId,
    ...body,
    assignedManagerId: body.assignedManagerId || user?._id,
    assignedManagerName: body.assignedManagerName || user?.name,
  });
  await logActivity(artistId, 'inquiry_created', `Inquiry: ${doc.clientName}`, 'inquiry', doc._id);
  return doc;
}

async function updateInquiry(artistId, inquiryId, body) {
  await requireArtist(artistId);
  const doc = await ArtistInquiry.findOneAndUpdate(
    { _id: inquiryId, artistId },
    { $set: body },
    { returnDocument: 'after' }
  );
  if (!doc) return null;
  if (body.status === 'confirmed') {
    await promoteInquiryToGig(artistId, doc);
  }
  await logActivity(artistId, 'inquiry_updated', `Inquiry ${doc.status}: ${doc.clientName}`, 'inquiry', doc._id);
  return doc;
}

async function promoteInquiryToGig(artistId, inquiry) {
  const existing = await ArtistGig.findOne({ inquiryId: inquiry._id });
  if (existing) return existing;
  const gig = await ArtistGig.create({
    artistId,
    inquiryId: inquiry._id,
    name: inquiry.eventName || `${inquiry.clientName} Gig`,
    location: inquiry.metadata?.whenWhere || '',
    gigDate: inquiry.eventDate || new Date(),
    rate: inquiry.expectedBudget || 0,
    expense: 0,
    paymentStatus: 'pending',
  });
  await logActivity(artistId, 'gig_confirmed', `Gig confirmed: ${gig.name}`, 'gig', gig._id);
  return gig;
}

async function listGigs(artistId) {
  await requireArtist(artistId);
  const gigs = await ArtistGig.find({ artistId }).sort({ gigDate: -1 }).lean();
  return gigs.map((g, i) => ({ ...g, sr: gigs.length - i, profit: (g.rate || 0) - (g.expense || 0) }));
}

async function createGig(artistId, body) {
  await requireArtist(artistId);
  const gig = await ArtistGig.create({ artistId, ...body });
  await logActivity(artistId, 'gig_created', `Gig: ${gig.name}`, 'gig', gig._id);
  return gig;
}

async function updateGig(artistId, gigId, body) {
  await requireArtist(artistId);
  const gig = await ArtistGig.findOneAndUpdate({ _id: gigId, artistId }, { $set: body }, { returnDocument: 'after' });
  if (gig) await logActivity(artistId, 'gig_updated', `Gig updated: ${gig.name}`, 'gig', gig._id);
  return gig;
}

async function listFinance(artistId, month) {
  await requireArtist(artistId);
  const ref = month ? new Date(month) : new Date();
  const { start, end } = monthBounds(ref);
  const entries = await ArtistFinanceEntry.find({ artistId, entryDate: { $gte: start, $lte: end } }).sort({ entryDate: -1 }).lean();
  let revenue = 0;
  let expenses = 0;
  const byCategory = {};
  entries.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    if (e.type === 'revenue') revenue += e.amount;
    else expenses += e.amount;
  });
  const profit = revenue - expenses;
  const expenseRatio = revenue > 0 ? Math.round((expenses / revenue) * 100) : 0;

  return {
    month: ref.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    revenue,
    expenses,
    net: profit,
    profit,
    expenseRatio,
    byCategory,
    entries,
  };
}

async function createFinanceEntry(artistId, body, user) {
  await requireArtist(artistId);
  const entry = await ArtistFinanceEntry.create({ artistId, ...body });
  await logActivity(artistId, 'finance_entry', `${entry.type}: ₹${entry.amount}`, 'finance', entry._id, { user: user?.name });
  return entry;
}

async function getCalendar(artistId, from, to) {
  await requireArtist(artistId);
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : new Date(start.getFullYear(), start.getMonth() + 3, 0);

  const [inquiries, gigs, manual, releases] = await Promise.all([
    ArtistInquiry.find({ artistId, eventDate: { $gte: start, $lte: end } }).lean(),
    ArtistGig.find({ artistId, gigDate: { $gte: start, $lte: end } }).lean(),
    ArtistCalendarEvent.find({ artistId, startAt: { $gte: start, $lte: end } }).lean(),
    ArtistContentRelease.find({ artistId, releaseDate: { $gte: start, $lte: end } }).lean(),
  ]);

  const events = [];

  inquiries.forEach((inq) => {
    const type = inq.status === 'dead' ? 'dead' : inq.status === 'confirmed' ? 'gig' : 'inquiry';
    events.push({
      id: `inq-${inq._id}`,
      type,
      title: inq.eventName || inq.clientName,
      date: inq.eventDate,
      status: inq.status,
      value: inq.expectedBudget,
      source: 'inquiry',
    });
  });

  gigs.forEach((g) => {
    events.push({
      id: `gig-${g._id}`,
      type: 'gig',
      title: g.name,
      date: g.gigDate,
      status: 'Confirmed',
      value: g.rate,
      source: 'gig',
    });
  });

  manual.forEach((e) => {
    events.push({
      id: `cal-${e._id}`,
      type: e.eventType,
      title: e.title,
      date: e.startAt,
      status: e.status,
      value: e.value,
      source: 'manual',
    });
  });

  releases.forEach((r) => {
    events.push({
      id: `rel-${r._id}`,
      type: 'release',
      title: r.title,
      date: r.releaseDate,
      status: 'Scheduled',
      value: null,
      source: 'release',
    });
  });

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getTimeline(artistId, limit = 50) {
  await requireArtist(artistId);
  return ArtistActivityLog.find({ artistId }).sort({ createdAt: -1 }).limit(limit).lean();
}

async function createCalendarEvent(artistId, body) {
  await requireArtist(artistId);
  const doc = await ArtistCalendarEvent.create({ artistId, ...body });
  await logActivity(artistId, 'calendar_event', `Event: ${doc.title}`, 'calendar', doc._id);
  return doc;
}

async function listDocuments(artistId) {
  await requireArtist(artistId);
  const contracts = await ArtistContract.find({
    artistId,
    documentUrl: { $exists: true, $ne: '' },
  }).sort({ createdAt: -1 }).lean();

  return {
    vaultAvailable: false,
    message: 'Central document vault is not implemented. Contract attachments are listed below.',
    items: contracts.map((c) => ({
      id: c._id,
      title: c.title,
      url: c.documentUrl,
      type: 'contract',
      status: c.status,
      createdAt: c.createdAt,
    })),
  };
}

async function listContracts(artistId) {
  await requireArtist(artistId);
  return ArtistContract.find({ artistId }).sort({ createdAt: -1 }).lean();
}

async function createContract(artistId, body) {
  await requireArtist(artistId);
  const doc = await ArtistContract.create({ artistId, ...body });
  await logActivity(artistId, 'contract_created', doc.title, 'contract', doc._id);
  return doc;
}

async function listNotes(artistId) {
  await requireArtist(artistId);
  return ArtistTeamNote.find({ artistId }).sort({ createdAt: -1 }).lean();
}

async function createNote(artistId, body, user) {
  await requireArtist(artistId);
  const doc = await ArtistTeamNote.create({
    artistId,
    body: body.body,
    authorId: user?._id,
    authorName: user?.name || 'Team',
  });
  await logActivity(artistId, 'note_added', 'Team note added', 'note', doc._id);
  return doc;
}

async function listContent(artistId) {
  await requireArtist(artistId);
  return ArtistContentRelease.find({ artistId }).sort({ releaseDate: -1 }).lean();
}

async function createContent(artistId, body) {
  await requireArtist(artistId);
  const doc = await ArtistContentRelease.create({ artistId, ...body });
  await logActivity(artistId, 'release_published', `Release: ${doc.title}`, 'content', doc._id);
  return doc;
}

async function getReleaseCorrelations(artistId) {
  await requireArtist(artistId);
  const releases = await ArtistContentRelease.find({ artistId }).sort({ releaseDate: -1 }).limit(10).lean();
  const metrics = await ArtistMetrics.findOne({ artistId }).lean();
  const history = metrics?.analyticsHistory || [];

  return releases.map((rel) => {
    const relDate = new Date(rel.releaseDate);
    const before = history.filter((h) => {
      const t = new Date(h.timestamp);
      return t >= new Date(relDate.getTime() - 14 * 86400000) && t < relDate;
    });
    const after = history.filter((h) => {
      const t = new Date(h.timestamp);
      return t >= relDate && t <= new Date(relDate.getTime() + 14 * 86400000);
    });
    const spBefore = before.at(-1)?.metrics?.spotify?.followers || 0;
    const spAfter = after.at(-1)?.metrics?.spotify?.followers || spBefore;
    return {
      releaseId: rel._id,
      title: rel.title,
      releaseDate: rel.releaseDate,
      spotifyDelta: spAfter - spBefore,
      inquiryCount: 0,
    };
  });
}

async function createInquiryFromWebhook(artistName, payload, leadId, taskId) {
  const artistId = await resolveArtistIdFromEnquiryName(artistName);
  if (!artistId) return null;

  const existing = leadId
    ? await ArtistInquiry.findOne({ artistId, leadId }).lean()
    : null;
  if (existing) return existing;

  const doc = await ArtistInquiry.create({
    artistId,
    source: 'website',
    clientName: payload.name,
    phone: payload.phone,
    email: payload.email,
    eventName: payload.company || payload.nature || 'Website Enquiry',
    eventDate: null,
    expectedBudget: parseBudgetFromText(payload.scaleReach || payload.vision),
    status: 'new',
    leadId,
    taskId,
    metadata: {
      company: payload.company,
      collaborationType: payload.collaborationType,
      nature: payload.nature,
      whenWhere: payload.whenWhere,
      scaleReach: payload.scaleReach,
      logistics: payload.logistics,
      vision: payload.vision,
      artist: payload.artist,
    },
  });
  await logActivity(artistId, 'inquiry_created', `Website enquiry: ${doc.clientName}`, 'inquiry', doc._id);
  return doc;
}

module.exports = {
  resolveArtistIdFromEnquiryName,
  requireArtist,
  getOverview,
  listInquiries,
  createInquiry,
  updateInquiry,
  listGigs,
  createGig,
  updateGig,
  listFinance,
  createFinanceEntry,
  getCalendar,
  createCalendarEvent,
  getTimeline,
  listDocuments,
  listContracts,
  createContract,
  listNotes,
  createNote,
  listContent,
  createContent,
  getReleaseCorrelations,
  createInquiryFromWebhook,
  computeAnalyticsScores,
  sliceHistoryByTimeframe,
  logActivity,
  EVENT_COLOR,
  parseBudgetFromText,
};
