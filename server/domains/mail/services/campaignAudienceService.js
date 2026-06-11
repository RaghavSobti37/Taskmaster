const ExlyBooking = require('../../../models/ExlyBooking');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');
const { normalizeEmail, isValidEmail } = require('../../../utils/emailValidation');
const { escapeRegExp } = require('../../data-hub/queryHelpers');

const CONTACT_BYPASS = bypassOptions('campaign_audience_exly');

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

async function listExlyAudienceContacts({ search = '', offeringId = 'all', limit = 100000 } = {}) {
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

  const contacts = Array.from(byEmail.values()).map((contact) => ({
    ...contact,
    rowData: exlyContactToRowData(contact),
  }));

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

module.exports = {
  listExlyAudienceContacts,
  listExlyAudienceOfferings,
  exlyContactToRowData,
};
