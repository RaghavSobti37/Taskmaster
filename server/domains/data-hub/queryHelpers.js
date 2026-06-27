const { escapeRegExp } = require('../person/identity');
const { buildDataHubExcludeFilter } = require('../../services/qa/qaTestData');
const {
  DATA_INLETS,
  isBookedCallSource,
  dedupeInletEntries,
} = require('../../../shared/dataInlets');
const { HUB_KEY_TO_FOLDER, CONTACT_BYPASS, isHubViewActive } = require('./folderCache');

const WEEKLY_DATE_FORMAT = '%Y-%U';

function dateCoalesceStage(field = 'createdAt') {
  return {
    $addFields: {
      _dateField: {
        $convert: {
          input: `$${field}`,
          to: 'date',
          onError: null,
          onNull: null,
        },
      },
    },
  };
}

async function countSinceDate(HubModel, match, since, field = 'createdAt') {
  const rows = await HubModel.aggregate([
    { $match: match },
    dateCoalesceStage(field),
    { $match: { _dateField: { $gte: since, $ne: null } } },
    { $count: 'n' },
  ]).option(CONTACT_BYPASS);
  return rows[0]?.n || 0;
}

async function aggregateWeeklyGrowth(HubModel, match, since, field = 'createdAt') {
  return HubModel.aggregate([
    { $match: match },
    dateCoalesceStage(field),
    { $match: { _dateField: { $gte: since, $ne: null } } },
    {
      $group: {
        _id: { $dateToString: { format: WEEKLY_DATE_FORMAT, date: '$_dateField' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).option(CONTACT_BYPASS);
}

async function aggregateInletBreakdown(HubModel, match) {
  if (isHubViewActive()) {
    return HubModel.aggregate([
      { $match: match },
      { $unwind: { path: '$inletKeys', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$inletKeys', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).option(CONTACT_BYPASS);
  }
  return HubModel.aggregate([
    { $match: match },
    { $unwind: { path: '$inlets', preserveNullAndEmptyArrays: false } },
    { $group: { _id: '$inlets.key', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).option(CONTACT_BYPASS);
}

function resolveLeadInletKey(lead) {
  if (isBookedCallSource(lead.source)) return 'booked_calls';
  if (lead.crmType === 'artist') return 'artist_crm';
  return 'leads';
}

function mapHubRow(c) {
  if (!c) return c;
  const inlets = c.inlets?.length
    ? dedupeInletEntries(c.inlets)
    : (c.inletKeys || []).map((key) => ({
      key: HUB_KEY_TO_FOLDER[key] || key,
      recordIds: [],
    }));
  return {
    ...c,
    _id: c.personId || c._id,
    personId: c.personId || c._id,
    inlets,
    inletCount: c.inletCount ?? inlets.length,
    isMultiInlet: c.isMultiInlet ?? inlets.length >= 2,
    inletLabels: inlets.map((i) => DATA_INLETS[i.key]?.label || i.key),
    updatedAt: c.updatedAt || c.lastActivityAt,
    lastActivityAt: c.lastActivityAt || c.updatedAt,
    createdAt: c.firstSeenAt || c.createdAt,
  };
}

const changedSince = (since) => {
  if (!since) return {};
  return {
    $or: [
      { createdAt: { $gte: since } },
      { updatedAt: { $gte: since } },
    ],
  };
};

const identityMatch = (email, phone) => {
  const clauses = [];
  if (email) clauses.push({ email });
  if (phone) clauses.push({ phone });
  return clauses.length ? { $or: clauses } : null;
};

const buildFolderQuery = (folder, extra = {}) => {
  const q = { ...extra };

  switch (folder) {
    case 'all':
      break;
    case 'exly':
      q.inExly = true;
      break;
    case 'leads':
      q.inCRM = true;
      break;
    case 'tsc':
    case 'outsourced':
      q.$or = [{ inOutsourced: true }, { inTsc: true }];
      break;
    case 'newsletter':
      q.inNewsletter = true;
      break;
    case 'artist_path':
      q.inArtistPath = true;
      break;
    case 'artist_crm':
      q.inArtistCrm = true;
      break;
    case 'booked_calls':
      q.inBookedCalls = true;
      break;
    case 'enquiries':
      q.inEnquiries = true;
      break;
    case 'unsubscribed':
      q.$or = [{ unsubscribed: true }, { emailStatus: 'Unsubscribed' }];
      break;
    case 'mail':
      q.inMailer = true;
      break;
    case 'community':
      q.inCommunity = true;
      break;
    case 'active':
      q.emailStatus = 'Active';
      q.$or = [
        { inMailer: true },
        { inExly: true },
        { inCRM: true },
        { inletCount: { $gte: 1 } },
      ];
      break;
    case 'loyal':
      q.isMultiInlet = true;
      break;
    default:
      break;
  }
  q.$and = q.$and || [];
  q.$and.push(buildDataHubExcludeFilter());
  return q;
};

function parseEnquiryDescription(description = '') {
  const fields = {};
  const patterns = {
    name: /^Name:\s*(.+)$/m,
    company: /^Company:\s*(.+)$/m,
    email: /^Email:\s*(.+)$/m,
    phone: /^Phone:\s*(.+)$/m,
    collaborationType: /^Collaboration type:\s*(.+)$/m,
    artist: /^Artist \/ talent:\s*(.+)$/m,
    nature: /^Project nature:\s*(.+)$/m,
    whenWhere: /^When & where:\s*(.+)$/m,
    scaleReach: /^Scale \/ reach:\s*(.+)$/m,
    logistics: /^Logistics:\s*(.+)$/m,
    vision: /^Vision \/ details:\s*(.+)$/m,
  };
  for (const [key, re] of Object.entries(patterns)) {
    const m = description.match(re);
    if (m) fields[key] = m[1].trim();
  }
  return fields;
}

module.exports = {
  WEEKLY_DATE_FORMAT,
  dateCoalesceStage,
  countSinceDate,
  aggregateWeeklyGrowth,
  aggregateInletBreakdown,
  resolveLeadInletKey,
  mapHubRow,
  changedSince,
  identityMatch,
  buildFolderQuery,
  parseEnquiryDescription,
  escapeRegExp,
};
