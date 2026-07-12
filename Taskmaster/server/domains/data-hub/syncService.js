/**
 * Data Hub inlet sync orchestration — extracted from DataHubService.
 */
const Lead = require('../../models/Lead');
const OutsourcedRecord = require('../../models/OutsourcedRecord');
const BookedCall = require('../../models/BookedCall');
const NewsletterSubscriber = require('../../models/NewsletterSubscriber');
const ExlyBooking = require('../../models/ExlyBooking');
const Task = require('../tasks/models/Task');
const { distinctEmails } = require('../mail/services/mailEventQueryService');
const DataHubSyncState = require('../../models/DataHubSyncState');
const ContactService = require('../../services/ContactService');
const { isCommunityText } = require('../../../shared/dataInlets');
const {
  changedSince,
  parseEnquiryDescription,
  resolveLeadInletKey,
} = require('./queryHelpers');
const { resetHubModelCache } = require('./folderCache');

const INCREMENTAL_BOOTSTRAP_MS = 24 * 60 * 60 * 1000;

async function loadFragmentedSources(match, since) {
  const timeFilter = since ? changedSince(since) : {};
  const [outsourced, bookedCalls, newsletter] = await Promise.all([
    OutsourcedRecord.find({ ...match, ...timeFilter }).lean(),
    BookedCall.find({ ...match, ...timeFilter }).lean(),
    NewsletterSubscriber.find({ ...match, ...timeFilter }).lean(),
  ]);
  return { outsourced, bookedCalls, newsletter };
}

async function runInletMerge({ since, onProgress, full = false } = {}) {
  const stats = { leads: 0, outsourced: 0, bookedCalls: 0, newsletter: 0, exly: 0, enquiries: 0, mail: 0, errors: 0 };
  const BATCH = 100;
  const log = (msg) => {
    if (onProgress) onProgress(msg);
  };

  log('booked_calls: CRM webhook only (sheet sync removed)');

  const runBatch = async (items, label, handler) => {
    if (!items.length) return;
    log(`${label}: merging ${items.length} records…`);
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      if (i === 0 || (i + BATCH) % 500 === 0 || i + BATCH >= items.length) {
        log(`${label}: ${Math.min(i + BATCH, items.length)}/${items.length}`);
      }
      await Promise.all(batch.map(async (item) => {
        try {
          await handler(item);
        } catch {
          stats.errors += 1;
        }
      }));
    }
  };

  const leadFilter = since ? changedSince(since) : {};
  const leads = await Lead.find(leadFilter).lean();
  log(`leads: loaded ${leads.length} for merge`);
  await runBatch(leads, 'leads', async (lead) => {
    if (!lead.email && !lead.phone) return;
    const inletKey = resolveLeadInletKey(lead);
    await ContactService.mergeContact({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      leadStatus: lead.leadStatus,
      leadQuality: lead.leadQuality,
      emailStatus: lead.emailStatus,
      unsubscribed: lead.unsubscribed,
      unsubscribeReason: lead.unsubscribeReason,
      recordId: lead._id,
      summary: {
        source: lead.source,
        leadStatus: lead.leadStatus,
        callStatus: lead.callStatus,
        nextFollowupDate: lead.nextFollowupDate,
        nextFollowupTime: lead.nextFollowupTime,
      },
      inletKey,
    }, inletKey === 'booked_calls' ? 'booked_calls' : inletKey === 'artist_crm' ? 'artist_crm' : 'crm');
    stats.leads += 1;
  });

  const timeFilter = since ? changedSince(since) : {};
  const [outsourcedRows, bookedCallRows, newsletterRows] = await Promise.all([
    OutsourcedRecord.find(timeFilter).lean(),
    BookedCall.find(timeFilter).lean(),
    NewsletterSubscriber.find(timeFilter).lean(),
  ]);

  await runBatch(outsourcedRows, 'outsourced', async (row) => {
    if (!row.email && !row.phone) return;
    const isCommunity = isCommunityText(row.campaign) || isCommunityText(row.originSource);
    await ContactService.mergeContact({
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,
      sourceFilename: row.sourceFilename,
      emailStatus: row.emailStatus,
      recordId: row._id,
      summary: { campaign: row.campaign, originSource: row.originSource, role: row.role },
      inletKey: isCommunity ? 'community' : 'outsourced',
    }, isCommunity ? 'community' : 'outsourced');
    stats.outsourced += 1;
  });

  await runBatch(bookedCallRows, 'booked_calls', async (row) => {
    if (!row.email && !row.phone) return;
    await ContactService.mergeContact({
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,
      emailStatus: row.emailStatus,
      recordId: row._id,
      summary: { source: row.source, callStatus: row.callStatus, bookedAt: row.bookedAt },
      inletKey: 'booked_calls',
    }, 'booked_calls');
    stats.bookedCalls += 1;
  });

  await runBatch(newsletterRows, 'newsletter', async (row) => {
    if (!row.email && !row.phone) return;
    await ContactService.mergeContact({
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,
      emailStatus: row.emailStatus,
      unsubscribed: row.unsubscribed,
      recordId: row._id,
      summary: { source: row.source, subscribedAt: row.subscribedAt },
      inletKey: 'newsletter',
    }, 'newsletter');
    stats.newsletter += 1;
  });

  log(`outsourced: ${outsourcedRows.length}, booked_calls: ${bookedCallRows.length}, newsletter: ${newsletterRows.length}`);

  const bookings = await ExlyBooking.find(since ? changedSince(since) : {}).lean();
  await runBatch(bookings, 'exly', async (booking) => {
    if (!booking.email && !booking.phone) return;
    const isCommunity = isCommunityText(booking.offeringTitle);
    const inletKey = isCommunity ? 'community' : 'exly';
    await ContactService.mergeContact({
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      exlyOfferingTitle: booking.offeringTitle,
      emailStatus: booking.emailStatus,
      unsubscribed: booking.unsubscribed,
      recordId: booking._id,
      summary: { offeringTitle: booking.offeringTitle, pricePaid: booking.pricePaid },
      inletKey,
    }, inletKey);
    stats.exly += 1;
  });

  const taskFilter = { type: 'enquiry', ...(since ? changedSince(since) : {}) };
  const tasks = await Task.find(taskFilter).select('description _id').lean();
  await runBatch(tasks, 'enquiries', async (task) => {
    const parsed = parseEnquiryDescription(task.description);
    if (!parsed.email && !parsed.phone) return;
    await ContactService.mergeContact({
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      recordId: task._id,
      summary: { artist: parsed.artist, company: parsed.company, collaborationType: parsed.collaborationType },
      inletKey: 'enquiries',
    }, 'enquiries');
    stats.enquiries += 1;
  });

  const mailEmails = await distinctEmails({ since });
  const validEmails = mailEmails.filter(Boolean);
  await runBatch(validEmails, 'mail', async (email) => {
    await ContactService.mergeContact({
      name: 'Anonymous',
      email,
      inletKey: 'mail',
      summary: { mailEventCount: 1 },
    }, 'mailer');
    stats.mail += 1;
  });

  return stats;
}

async function getSyncState() {
  let state = await DataHubSyncState.findOne({ configKey: 'incremental' });
  if (!state) {
    state = await DataHubSyncState.create({ configKey: 'incremental' });
  }
  return state;
}

/**
 * Sync only new/changed records into PersonIndex hub (default).
 * Pass { full: true } to re-merge everything (one-off / script).
 */
async function syncAllInlets({
  incremental = true,
  onProgress,
  full = false,
  repairDuplicateInlets,
  clearFolderCache,
} = {}) {
  const syncStartedAt = new Date();
  const state = await getSyncState();
  let since = null;

  if (incremental && !full) {
    if (!state.lastFullSyncAt && !state.lastSyncedAt) {
      since = null;
    } else {
      since = state.lastSyncedAt
        ? new Date(state.lastSyncedAt)
        : new Date(Date.now() - INCREMENTAL_BOOTSTRAP_MS);
    }
  }

  const stats = await runInletMerge({ since, onProgress, full: !incremental || full });
  const repairedInlets = repairDuplicateInlets ? await repairDuplicateInlets({ onProgress }) : 0;
  if (repairedInlets) stats.repairedInlets = repairedInlets;

  if (full) {
    const PersonHubBuilder = require('../../services/PersonHubBuilder');
    if (onProgress) onProgress('Rebuilding PersonHubView for all persons…');
    const hubRebuild = await PersonHubBuilder.rebuildAll({ onProgress });
    stats.hubViewsRebuilt = hubRebuild.processed;
    resetHubModelCache();
  } else {
    resetHubModelCache();
  }

  await DataHubSyncState.findOneAndUpdate(
    { configKey: 'incremental' },
    {
      $set: {
        lastSyncedAt: syncStartedAt,
        lastStats: stats,
        ...(full ? { lastFullSyncAt: syncStartedAt } : {}),
      },
    },
    { upsert: true },
  );

  if (clearFolderCache) clearFolderCache();
  return { ...stats, incremental: incremental && !full, since: since?.toISOString() || null, syncedAt: syncStartedAt };
}

module.exports = {
  INCREMENTAL_BOOTSTRAP_MS,
  loadFragmentedSources,
  runInletMerge,
  getSyncState,
  syncAllInlets,
};
