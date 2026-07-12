const Lead = require('../../models/Lead');
const ExlyBooking = require('../../models/ExlyBooking');
const Task = require('../tasks/models/Task');
const {
  identityMatch,
  escapeRegExp,
} = require('./queryHelpers');
const { clearFolderCache: clearFolderCacheState } = require('./folderCache');
const { loadFragmentedSources } = require('./syncService');
const {
  crmInletProcessor,
  exlyInletProcessor,
  newsletterInletProcessor,
  outsourcedInletProcessor,
  bookedCallsInletProcessor,
  enquiriesInletProcessor,
  mailInletProcessor,
} = require('./processors');

async function reconcilePerson(email, phone) {
  const match = identityMatch(email, phone);
  if (!match) return null;

  const [leads, fragmented, exlyBookings, enquiryTasks] = await Promise.all([
    Lead.find(match).lean(),
    loadFragmentedSources(match),
    ExlyBooking.find(match).lean(),
    Task.find({ type: 'enquiry', description: { $regex: escapeRegExp(email || phone), $options: 'i' } }).lean(),
  ]);
  const { outsourced, bookedCalls: bookedCallRecords, newsletter } = fragmented;

  let contact = null;
  const primaryName = leads[0]?.name || outsourced[0]?.name || bookedCallRecords[0]?.name || newsletter[0]?.name || exlyBookings[0]?.name || 'Anonymous';
  const ctx = { primaryName, email, phone, contact };

  contact = await crmInletProcessor.reconcileLeads(leads, { ...ctx, contact });
  contact = await outsourcedInletProcessor.reconcileOutsourcedRows(outsourced, { ...ctx, contact });
  contact = await bookedCallsInletProcessor.reconcileBookedCallRows(bookedCallRecords, { ...ctx, contact });
  contact = await newsletterInletProcessor.reconcileNewsletterRows(newsletter, { ...ctx, contact });
  contact = await exlyInletProcessor.reconcileExlyBookings(exlyBookings, { ...ctx, contact });
  contact = await enquiriesInletProcessor.reconcileEnquiryTasks(enquiryTasks, { ...ctx, contact });
  contact = await mailInletProcessor.reconcileMailEngagement(email, { ...ctx, contact });

  clearFolderCacheState();
  return contact;
}

module.exports = {
  reconcilePerson,
};
