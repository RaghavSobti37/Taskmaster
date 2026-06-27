const Lead = require('../../../models/Lead');
const BookedCall = require('../../../models/BookedCall');
const ContactService = require('../../../services/ContactService');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');
const { isBookedCallSource, BOOKED_CALL_SOURCE_RE } = require('../../../../shared/dataInlets');

async function reconcileBookedCallRows(bookedCallRecords, { primaryName, email, phone, contact: initialContact }) {
  let contact = initialContact;
  for (const row of bookedCallRecords) {
    contact = await ContactService.mergeContact({
      name: row.name || primaryName,
      email: row.email || email,
      phone: row.phone || phone,
      city: row.city,
      emailStatus: row.emailStatus,
      recordId: row._id,
      summary: { source: row.source, callStatus: row.callStatus, bookedAt: row.bookedAt },
      inletKey: 'booked_calls',
    }, 'booked_calls');
  }
  return contact;
}

async function loadBookedCallsSection(match) {
  const [leadBooked, callRows] = await Promise.all([
    Lead.find(match).sort({ updatedAt: -1 }).lean(),
    BookedCall.find(match).sort({ bookedAt: -1 }).lean(),
  ]);
  return {
    section: 'booked',
    bookedCalls: {
      leads: leadBooked.filter((l) => isBookedCallSource(l.source)),
      calls: callRows,
    },
  };
}

function appendBookedCallsTimeline(bookedCallRecords) {
  return bookedCallRecords.map((row) => ({
    type: 'booked_call',
    date: row.bookedAt || row.createdAt,
    label: `Booked call: ${row.source || 'call'}`,
    data: row,
  }));
}

function filterBookedCallLeads(leads) {
  return leads.filter((l) => isBookedCallSource(l.source));
}

async function buildBookedCallsAnalytics(result, { weekAgo }) {
  const bookedMatch = { source: { $regex: BOOKED_CALL_SOURCE_RE } };
  const [funnel, callStatus, newWeek, connected, totalBooked] = await Promise.all([
    aggregateWithTenant(Lead, [{ $match: bookedMatch }, { $group: { _id: '$leadStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    aggregateWithTenant(Lead, [{ $match: bookedMatch }, { $group: { _id: '$callStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Lead.countDocuments({ ...bookedMatch, createdAt: { $gte: weekAgo } }),
    Lead.countDocuments({ ...bookedMatch, meaningfulConnect: 'YES' }),
    Lead.countDocuments(bookedMatch),
  ]);
  result.funnel = funnel;
  result.callStatus = callStatus;
  result.kpis = [
    { key: 'total', label: 'Booked Calls', value: totalBooked },
    { key: 'newWeek', label: 'New This Week', value: newWeek },
    { key: 'connected', label: 'Meaningful Connect', value: connected },
    {
      key: 'connectRate',
      label: 'Connect Rate',
      value: totalBooked ? Math.round((connected / totalBooked) * 100) : 0,
      format: 'percent',
    },
  ];
}

module.exports = {
  reconcileBookedCallRows,
  loadBookedCallsSection,
  appendBookedCallsTimeline,
  filterBookedCallLeads,
  buildBookedCallsAnalytics,
};
