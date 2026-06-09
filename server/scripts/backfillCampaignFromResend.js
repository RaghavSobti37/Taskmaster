/**
 * Backfill MailEvent records for a campaign from Resend sent-email history.
 * Resend list/get exposes last_event + tags (campaign_id, recipient_email) but not open/click IP.
 * Geo is rebuilt afterward via rebuildCampaignLocationBreakdown.js (trusted rules + click inference).
 *
 * Usage (repo root):
 *   node server/scripts/backfillCampaignFromResend.js <campaignIdOrMongoId> [--dry-run] [--prod]
 *
 * Requires RESEND_API_KEY in server/.env
 * DB: resolveMongoUri() — MAIL_USE_PROD_DB=true or --prod uses MONGODB_URI_PROD.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Resend } = require('resend');
const { resolveMongoUri, assertSafeDbTarget } = require('../config/database');
const { resolveCampaignByParam } = require('../utils/resolveCampaign');
const { sanitizeResendTagValue } = require('../utils/resendTags');
const MailEvent = require('../models/MailEvent');
const { buildRegisteredLocationBreakdown } = require('../utils/campaignRegisteredLocation');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const useProd = argv.includes('--prod');
if (useProd) process.env.MAIL_USE_PROD_DB = 'true';

const args = argv.filter((a) => a !== '--dry-run' && a !== '--prod');
const campaignKey = args[0];

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey && resendApiKey !== 'mock_resend_api_key' ? new Resend(resendApiKey) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tagMatchesCampaign = (tags, campaignTag, mongoId) => {
  if (!Array.isArray(tags)) return false;
  const campTag = tags.find((t) => t.name === 'campaign_id');
  if (!campTag) return false;
  const v = String(campTag.value || '');
  return v === campaignTag || v === mongoId || v === sanitizeResendTagValue(campaignTag);
};

const resolveEmailFromResend = (emailRow, tags = []) => {
  const to = Array.isArray(emailRow?.to) ? emailRow.to[0] : emailRow?.to;
  if (to && String(to).includes('@')) return String(to).toLowerCase().trim();

  const recTag = (tags || []).find((t) => t.name === 'recipient_email');
  if (!recTag?.value) return null;
  const decoded = String(recTag.value)
    .replace(/_at_/g, '@')
    .replace(/_/g, '.');
  if (decoded.includes('@')) return decoded.toLowerCase().trim();
  return null;
};

const mapLastEventToTypes = (lastEvent) => {
  switch (lastEvent) {
    case 'delivered':
      return ['Delivery'];
    case 'opened':
      return ['Delivery', 'Open'];
    case 'clicked':
      return ['Delivery', 'Open', 'Click'];
    case 'bounced':
    case 'complained':
      return ['Bounce'];
    case 'failed':
      return ['Failed'];
    default:
      return [];
  }
};

const fetchResendEmailsByIds = async (messageIds = []) => {
  const rows = [];
  for (const id of messageIds) {
    await sleep(550);
    const { data, error } = await resend.emails.get(id);
    if (error) {
      console.warn(`Resend get ${id}: ${error.message}`);
      continue;
    }
    if (data) rows.push(data);
  }
  return rows;
};

const listResendEmailsForCampaign = async (campaignTag, mongoId, knownMessageIds = new Set(), { maxPages = 50 } = {}) => {
  if (knownMessageIds.size > 0) {
    return fetchResendEmailsByIds([...knownMessageIds]);
  }

  const matched = new Map();
  let after;
  let page = 0;

  while (page < maxPages) {
    const params = { limit: 100 };
    if (after) params.after = after;

    const { data, error } = await resend.emails.list(params);
    if (error) throw new Error(`Resend list failed: ${error.message}`);
    const rows = data?.data || [];
    if (!rows.length) break;

    for (const row of rows) {
      await sleep(550);
      const detail = await resend.emails.get(row.id);
      if (detail.error) continue;
      const tags = detail.data?.tags;
      if (tagMatchesCampaign(tags, campaignTag, mongoId)) {
        matched.set(row.id, { ...detail.data, tags: tags || [] });
      }
    }

    if (!data.has_more) break;
    after = rows[rows.length - 1].id;
    page++;
    await sleep(300);
  }

  return [...matched.values()];
};

const hasMailEvent = async (campaignMongoId, messageId, eventType, email) => {
  const q = {
    campaignId: campaignMongoId,
    eventType,
    email,
  };
  if (messageId) q.messageId = messageId;
  const existing = await MailEvent.findOne(q).select('_id').setOptions({ bypassTenant: true }).lean();
  return !!existing;
};

(async () => {
  if (!campaignKey) {
    console.error(
      'Usage: node server/scripts/backfillCampaignFromResend.js <campaignIdOrMongoId> [--dry-run] [--prod]',
    );
    process.exit(1);
  }
  if (!resend) {
    console.error('RESEND_API_KEY is not configured in server/.env');
    process.exit(1);
  }

  const { dbUri, source } = resolveMongoUri();
  if (!dbUri) {
    console.error('MONGODB_URI is not set (see server/.env)');
    process.exit(1);
  }

  assertSafeDbTarget(dbUri, { source });
  await mongoose.connect(dbUri);

  const resolved = await resolveCampaignByParam(campaignKey, { lean: false });
  if (!resolved) {
    console.error(`Campaign not found: ${campaignKey}`);
    process.exit(1);
  }

  const { campaign, Model } = resolved;
  const mongoId = campaign._id;
  const publicCampaignId = campaign.campaignId || mongoId.toString();

  console.log(
    `Campaign: ${campaign.title || campaign.name || mongoId} | _id=${mongoId} | campaignId=${publicCampaignId}`,
  );
  console.log(`DB source: ${source}`);
  console.log(`Mode: ${dryRun ? 'dry-run (no writes)' : 'apply'}`);

  console.log('Fetching Resend sent emails (paginated, filter by campaign_id tag)...');
  const knownMessageIds = new Set();
  for (const r of campaign.recipients || []) {
    if (r.messageId) knownMessageIds.add(r.messageId);
  }
  const sendEvents = await MailEvent.find({
    campaignId: mongoId,
    eventType: 'Send',
    'metadata.messageId': { $exists: true },
  })
    .select('metadata.messageId')
    .setOptions({ bypassTenant: true })
    .lean();
  for (const evt of sendEvents) {
    if (evt.metadata?.messageId) knownMessageIds.add(evt.metadata.messageId);
  }
  console.log(`Known Resend message IDs from campaign: ${knownMessageIds.size}`);

  const resendEmails = await listResendEmailsForCampaign(
    publicCampaignId,
    mongoId.toString(),
    knownMessageIds,
  );
  console.log(`Resend emails for campaign: ${resendEmails.length}`);

  const stats = { created: 0, skipped: 0, recipientUpdates: 0 };
  const createdByType = {};

  for (const row of resendEmails) {
    const email = resolveEmailFromResend(row, row.tags);
    if (!email) {
      stats.skipped++;
      continue;
    }

    const messageId = row.id;
    const timestamp = row.created_at ? new Date(row.created_at) : new Date();
    const eventTypes = mapLastEventToTypes(row.last_event);

    for (const eventType of eventTypes) {
      const exists = await hasMailEvent(mongoId, messageId, eventType, email);
      if (exists) {
        stats.skipped++;
        continue;
      }

      const doc = {
        eventType,
        email,
        timestamp,
        campaignId: mongoId,
        messageId,
        metadata: { source: 'RESEND_BACKFILL', last_event: row.last_event },
      };

      if (!dryRun) {
        await MailEvent.create(doc);
      }
      stats.created++;
      createdByType[eventType] = (createdByType[eventType] || 0) + 1;
    }

    const recipient = (campaign.recipients || []).find(
      (r) => r.email && r.email.toLowerCase() === email,
    );
    if (recipient) {
      let statusChanged = false;
      if (!recipient.messageId && messageId) {
        recipient.messageId = messageId;
        statusChanged = true;
      }
      const statusFromEvent = {
        clicked: 'Clicked',
        opened: 'Opened',
        delivered: 'Sent',
        bounced: 'Bounced',
        complained: 'Bounced',
        failed: 'Failed',
      }[row.last_event];
      if (
        statusFromEvent
        && !['Bounced', 'Unsubscribed', 'Invalid', 'Cancelled'].includes(recipient.status)
      ) {
        const rank = { Pending: 0, Queued: 1, Failed: 2, Sent: 3, Opened: 4, Clicked: 5 };
        if ((rank[statusFromEvent] || 0) > (rank[recipient.status] || 0)) {
          recipient.status = statusFromEvent;
          statusChanged = true;
        }
      }
      if (statusChanged && !dryRun) {
        stats.recipientUpdates++;
      }
    }
  }

  if (!dryRun && stats.recipientUpdates > 0) {
    await Model.updateOne({ _id: mongoId }, { $set: { recipients: campaign.recipients } }).setOptions({
      bypassTenant: true,
    });
  }

  console.log('Backfill summary:', JSON.stringify({ ...stats, createdByType }, null, 2));

  const registered = await buildRegisteredLocationBreakdown(mongoId, campaign.recipients || []);
  const breakdown = Object.entries(registered.locationBreakdown)
    .map(([city, s]) => ({ city, opens: s.opens, clicks: s.clicks, total: s.opens + s.clicks }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  console.log('Computed locationBreakdown (CRM registered):', JSON.stringify(breakdown, null, 2));

  if (!dryRun) {
    await Model.updateOne(
      { _id: mongoId },
      { $set: { locationBreakdown: registered.locationBreakdown, timeSeries: registered.timeSeries } },
    ).setOptions({ bypassTenant: true });
    console.log('Campaign document updated (locationBreakdown + timeSeries).');
  } else {
    console.log('Dry-run complete — no writes.');
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
