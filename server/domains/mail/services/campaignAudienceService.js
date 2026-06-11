const ExlyBooking = require('../../../models/ExlyBooking');
const Lead = require('../../../models/Lead');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');
const { normalizeEmail, isValidEmail } = require('../../../utils/emailValidation');
const { escapeRegExp, buildFolderQuery, mapHubRow } = require('../../data-hub/queryHelpers');
const { buildDataHubExcludeFilter } = require('../../../services/qa/qaTestData');
const { resolveHubModel } = require('../../data-hub/folderCache');
const { getFolderCounts } = require('../../data-hub/listService');
const { DATA_INLETS, INLET_KEYS } = require('../../../../shared/dataInlets');
const { filterContactsByEngagement } = require('./campaignEngagementService');

const CONTACT_BYPASS = bypassOptions('campaign_audience_exly');
const DATA_HUB_BYPASS = bypassOptions('campaign_audience_data_hub');

const CAMPAIGN_DATA_HUB_FOLDER_KEYS = INLET_KEYS.filter((k) => k !== 'unsubscribed');

function sanitizeInletKeys(keys = []) {
  const arr = Array.isArray(keys) ? keys : [keys];
  return [...new Set(arr
    .map((k) => String(k || '').trim())
    .filter((k) => CAMPAIGN_DATA_HUB_FOLDER_KEYS.includes(k)))];
}

function buildInletFlagCondition(inletKey) {
  switch (inletKey) {
    case 'exly':
      return { inExly: true };
    case 'leads':
      return { inCRM: true };
    case 'tsc':
    case 'outsourced':
      return { $or: [{ inOutsourced: true }, { inTsc: true }] };
    case 'newsletter':
      return { inNewsletter: true };
    case 'artist_path':
      return { inArtistPath: true };
    case 'artist_crm':
      return { inArtistCrm: true };
    case 'booked_calls':
      return { inBookedCalls: true };
    case 'enquiries':
      return { inEnquiries: true };
    case 'mail':
      return { inMailer: true };
    case 'community':
      return { inCommunity: true };
    case 'active':
      return {
        emailStatus: 'Active',
        $or: [
          { inMailer: true },
          { inExly: true },
          { inCRM: true },
          { inletCount: { $gte: 1 } },
        ],
      };
    case 'loyal':
      return { isMultiInlet: true };
    default:
      return null;
  }
}

function buildInletAudienceQuery({ includeInlets = [], excludeInlets = [], extra = {} } = {}) {
  const safeInclude = sanitizeInletKeys(includeInlets);
  const safeExclude = sanitizeInletKeys(excludeInlets);
  const q = { ...extra };
  q.$and = q.$and || [];

  if (safeInclude.length > 0) {
    const orClauses = safeInclude.map(buildInletFlagCondition).filter(Boolean);
    if (orClauses.length === 1) q.$and.push(orClauses[0]);
    else if (orClauses.length > 1) q.$and.push({ $or: orClauses });
  }

  for (const key of safeExclude) {
    const cond = buildInletFlagCondition(key);
    if (cond) q.$and.push({ $nor: [cond] });
  }

  q.$and.push(buildDataHubExcludeFilter());
  return q;
}

function exlyContactToRowData(contact) {
  const offerings = (contact.exlyOfferings || [])
    .map((o) => o.title)
    .filter(Boolean);
  const offeringLabel = offerings.length ? offerings.join(', ') : (contact.exlyOfferingTitle || '');
  return {
    name: contact.name || '',
    email: contact.email || '',
    source: 'Exly',
    exlyOfferingTitle: offeringLabel,
    offering: offeringLabel,
  };
}

function buildExlyBookingQuery({ offeringId } = {}) {
  const query = {
    email: { $exists: true, $ne: '' },
    unsubscribed: { $ne: true },
    emailStatus: { $nin: ['Unsubscribed', 'Bounced', 'Invalid'] },
  };
  if (offeringId && offeringId !== 'all') {
    query.offeringId = offeringId;
  }
  return query;
}

async function listExlyAudienceContacts({ search = '', offeringId = 'all', limit = 100000, engagement = 'all' } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100000, 1), 100000);
  const bookings = await ExlyBooking.find(buildExlyBookingQuery({ offeringId }))
    .select('name email emailStatus offeringTitle offeringId bookedOn')
    .sort({ bookedOn: -1 })
    .limit(safeLimit)
    .setOptions(CONTACT_BYPASS)
    .lean();

  const escaped = search ? escapeRegExp(String(search).trim()) : '';
  const searchRe = escaped ? new RegExp(escaped, 'i') : null;

  const byEmail = new Map();
  for (const booking of bookings) {
    const email = normalizeEmail(booking.email);
    if (!email || !isValidEmail(email)) continue;
    if (searchRe && !searchRe.test(booking.name || '') && !searchRe.test(email)) continue;

    const offering = {
      offeringId: booking.offeringId,
      title: booking.offeringTitle,
      purchasedAt: booking.bookedOn,
    };

    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        _id: `exly:${email}`,
        name: (booking.name || '').trim(),
        email,
        emailStatus: booking.emailStatus || 'Pending',
        exlyOfferingTitle: booking.offeringTitle || '',
        exlyOfferings: [offering],
        source: 'Exly',
        rowData: {},
      });
      continue;
    }

    const seenOffering = existing.exlyOfferings.some((o) => o.offeringId === offering.offeringId);
    if (!seenOffering) existing.exlyOfferings.push(offering);
    if (!existing.name && booking.name) existing.name = booking.name.trim();
  }

  let contacts = Array.from(byEmail.values()).map((contact) => ({
    ...contact,
    rowData: exlyContactToRowData(contact),
  }));

  contacts = await filterContactsByEngagement(contacts, engagement);

  return { contacts, total: contacts.length };
}

async function listExlyAudienceOfferings() {
  const rows = await ExlyBooking.aggregate([
    {
      $match: {
        offeringId: { $exists: true, $ne: '' },
        offeringTitle: { $exists: true, $ne: '' },
      },
    },
    {
      $group: {
        _id: '$offeringId',
        title: { $first: '$offeringTitle' },
        count: { $sum: 1 },
      },
    },
    { $sort: { title: 1 } },
  ]).option(CONTACT_BYPASS);

  return rows.map((row) => ({
    offeringId: row._id,
    title: row.title,
    count: row.count,
  }));
}

function dataHubContactToRowData(contact, folder) {
  const inletLabels = (contact.inletLabels || []).filter(Boolean).join(', ');
  const folderLabel = DATA_INLETS[folder]?.label || DATA_INLETS.all?.label || 'Data Hub';
  return {
    name: contact.name || '',
    email: contact.email || '',
    source: folder && folder !== 'all' ? folderLabel : (inletLabels || 'Data Hub'),
    inlets: inletLabels,
    city: contact.city || '',
  };
}

async function loadLeadMapByEmail(emails) {
  if (!emails.length) return new Map();
  const leads = await Lead.find({ email: { $in: emails } })
    .select('name email phone leadStatus emailStatus location city source contactCategory crmType')
    .setOptions(DATA_HUB_BYPASS)
    .lean();
  const map = new Map();
  for (const lead of leads) {
    const key = normalizeEmail(lead.email);
    if (key && !map.has(key)) map.set(key, lead);
  }
  return map;
}

async function listDataHubAudienceContacts({
  folder = 'all',
  includeInlets = [],
  excludeInlets = [],
  search = '',
  limit = 100000,
  engagement = 'all',
} = {}) {
  const safeInclude = sanitizeInletKeys(includeInlets);
  const safeExclude = sanitizeInletKeys(excludeInlets);
  const safeFolder = folder && folder !== 'all' && CAMPAIGN_DATA_HUB_FOLDER_KEYS.includes(folder)
    ? folder
    : 'all';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100000, 1), 100000);
  const HubModel = await resolveHubModel();
  const baseExtra = {
    email: { $exists: true, $ne: '' },
    unsubscribed: { $ne: true },
    emailStatus: { $nin: ['Unsubscribed', 'Bounced', 'Invalid'] },
  };
  const useInletRules = safeInclude.length > 0 || safeExclude.length > 0;
  const query = useInletRules
    ? buildInletAudienceQuery({ includeInlets: safeInclude, excludeInlets: safeExclude, extra: baseExtra })
    : buildFolderQuery(safeFolder, baseExtra);

  const escaped = search ? escapeRegExp(String(search).trim()) : '';
  if (escaped) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  const rows = await HubModel.find(query)
    .setOptions(DATA_HUB_BYPASS)
    .sort({ lastActivityAt: -1 })
    .limit(safeLimit)
    .lean();

  const mapped = rows.map(mapHubRow).filter((c) => {
    const email = normalizeEmail(c.email);
    return email && isValidEmail(email);
  });

  const leadByEmail = await loadLeadMapByEmail(mapped.map((c) => normalizeEmail(c.email)).filter(Boolean));

  let contacts = mapped.map((person) => {
    const email = normalizeEmail(person.email);
    const lead = leadByEmail.get(email);
    const contact = {
      _id: `dh:${person.personId || person._id}`,
      personId: person.personId || person._id,
      name: (person.name || lead?.name || '').trim(),
      email,
      emailStatus: person.emailStatus || lead?.emailStatus || 'Pending',
      inletLabels: person.inletLabels || [],
      leadStatus: lead?.leadStatus || 'Fresh',
      folder: useInletRules ? 'all' : safeFolder,
      leadId: lead?._id,
      lead,
      rowData: {},
    };
    contact.rowData = lead
      ? {
        name: lead.name || contact.name,
        email: contact.email,
        source: useInletRules
          ? ((contact.inletLabels || []).join(', ') || 'Data Hub')
          : (DATA_INLETS[safeFolder]?.label || 'Data Hub'),
        inlets: (contact.inletLabels || []).join(', '),
      }
      : dataHubContactToRowData(contact, useInletRules ? 'all' : safeFolder);
    return contact;
  });

  contacts = await filterContactsByEngagement(contacts, engagement);

  return {
    contacts,
    total: contacts.length,
    folder: useInletRules ? 'all' : safeFolder,
    includeInlets: safeInclude,
    excludeInlets: safeExclude,
  };
}

async function listDataHubAudienceFolders() {
  const { folders = [] } = await getFolderCounts();
  const allowed = new Set(['all', ...CAMPAIGN_DATA_HUB_FOLDER_KEYS]);
  return {
    folders: folders
      .filter((f) => allowed.has(f.key))
      .map((f) => ({
        key: f.key,
        label: f.label || DATA_INLETS[f.key]?.label || f.key,
        count: f.count ?? 0,
      })),
  };
}

module.exports = {
  listExlyAudienceContacts,
  listExlyAudienceOfferings,
  exlyContactToRowData,
  listDataHubAudienceContacts,
  listDataHubAudienceFolders,
  dataHubContactToRowData,
  CAMPAIGN_DATA_HUB_FOLDER_KEYS,
  sanitizeInletKeys,
  buildInletFlagCondition,
  buildInletAudienceQuery,
};
