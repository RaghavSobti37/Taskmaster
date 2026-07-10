const PersonHubView = require('../models/PersonHubView');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const ExlyBooking = require('../models/ExlyBooking');
const Lead = require('../models/Lead');
const { buildDataHubExcludeFilter } = require('./qa/qaTestData');
const { INLET_KEYS } = require('../../shared/dataInlets');
const { normalizeEmail, isValidEmail } = require('../utils/emailValidation');

const CONTACT_BYPASS = { bypassTenant: true };
const VALID_FOLDER_KEYS = new Set(INLET_KEYS);

const buildFolderQuery = (folder, extra = {}) => {
  const q = { ...extra };

  switch (folder) {
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

const isSendableEmail = (email, leadByEmail) => {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return false;
  const lead = leadByEmail.get(clean);
  if (lead?.unsubscribed || lead?.emailStatus === 'Unsubscribed') return false;
  if (lead?.emailStatus === 'Bounced' || lead?.emailStatus === 'Invalid') return false;
  return true;
};

const recipientRow = ({ email, name, source, rowData = {} }) => ({
  email: normalizeEmail(email),
  name: name || email.split('@')[0],
  rowData: { source, ...rowData },
});

const loadLeadMap = async (emails) => {
  if (!emails.length) return new Map();
  const leads = await Lead.find({ email: { $in: emails } })
    .select('email name unsubscribed emailStatus')
    .setOptions(CONTACT_BYPASS)
    .lean();
  const map = new Map();
  for (const lead of leads) {
    const key = normalizeEmail(lead.email);
    if (key) map.set(key, lead);
  }
  return map;
};

const mergeRecipient = (map, entry) => {
  const email = normalizeEmail(entry.email);
  if (!email || !isValidEmail(email)) return;
  if (map.has(email)) {
    const existing = map.get(email);
    existing.rowData = { ...existing.rowData, ...entry.rowData };
    if (!existing.name && entry.name) existing.name = entry.name;
    return;
  }
  map.set(email, entry);
};

async function resolveNewsletterAudience(audience = {}, excludedEmails = []) {
  const excludeSet = new Set((excludedEmails || []).map(normalizeEmail).filter(Boolean));
  const recipientMap = new Map();

  if (audience.newsletterSubscribers) {
    const subs = await NewsletterSubscriber.find({
      unsubscribed: false,
      email: { $exists: true, $ne: '' },
    })
      .select('email name emailStatus')
      .setOptions(CONTACT_BYPASS)
      .lean();
    for (const sub of subs) {
      if (sub.emailStatus === 'Unsubscribed' || sub.emailStatus === 'Bounced') continue;
      mergeRecipient(recipientMap, recipientRow({
        email: sub.email,
        name: sub.name,
        source: 'newsletter_subscribers',
      }));
    }
  }

  if (audience.artistPath) {
    const people = await PersonHubView.find({
      inArtistPath: true,
      email: { $exists: true, $ne: '' },
      unsubscribed: { $ne: true },
      emailStatus: { $nin: ['Unsubscribed', 'Bounced', 'Invalid'] },
    })
      .select('email name')
      .setOptions(CONTACT_BYPASS)
      .lean();
    for (const person of people) {
      mergeRecipient(recipientMap, recipientRow({
        email: person.email,
        name: person.name,
        source: 'artist_path',
      }));
    }
  }

  const offeringIds = (audience.exlyOfferingIds || []).filter(Boolean);
  if (offeringIds.length) {
    const bookings = await ExlyBooking.find({
      offeringId: { $in: offeringIds },
      email: { $exists: true, $ne: '' },
      unsubscribed: { $ne: true },
      emailStatus: { $nin: ['Unsubscribed', 'Bounced'] },
    })
      .select('email name offeringTitle offeringId')
      .setOptions(CONTACT_BYPASS)
      .lean();
    for (const booking of bookings) {
      mergeRecipient(recipientMap, recipientRow({
        email: booking.email,
        name: booking.name,
        source: 'exly_offerings',
        rowData: { offering: booking.offeringTitle || booking.offeringId },
      }));
    }
  }

  const folders = (audience.dataHubFolders || []).filter((f) => VALID_FOLDER_KEYS.has(f));
  for (const folder of folders) {
    const query = buildFolderQuery(folder, {
      email: { $exists: true, $ne: '' },
      unsubscribed: { $ne: true },
      emailStatus: { $nin: ['Unsubscribed', 'Bounced', 'Invalid'] },
    });
    const people = await PersonHubView.find(query)
      .select('email name')
      .setOptions(CONTACT_BYPASS)
      .lean();
    for (const person of people) {
      mergeRecipient(recipientMap, recipientRow({
        email: person.email,
        name: person.name,
        source: `data_hub:${folder}`,
      }));
    }
  }

  for (const raw of audience.manualEmails || []) {
    mergeRecipient(recipientMap, recipientRow({
      email: raw,
      name: raw.split('@')[0],
      source: 'manual',
    }));
  }

  const emails = [...recipientMap.keys()];
  const leadByEmail = await loadLeadMap(emails);

  const recipients = [];
  let skipped = 0;
  for (const [email, entry] of recipientMap.entries()) {
    if (excludeSet.has(email)) {
      skipped += 1;
      continue;
    }
    if (!isSendableEmail(email, leadByEmail)) {
      skipped += 1;
      continue;
    }
    recipients.push(entry);
  }

  return {
    recipients,
    totalResolved: recipientMap.size,
    skipped,
    sourceBreakdown: recipients.reduce((acc, r) => {
      const key = r.rowData?.source || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = {
  resolveNewsletterAudience,
  buildFolderQuery,
};
