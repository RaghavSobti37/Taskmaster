const CampaignChannelOutcome = require('../models/CampaignChannelOutcome');
const WhatsappCampaignRegistry = require('../models/WhatsappCampaignRegistry');
const AisensyCampaignSend = require('../models/AisensyCampaignSend');
const ContactService = require('./ContactService');
const Lead = require('../models/Lead');
const { normalizeEmail, normalizePhone } = require('./havellsDataHubService');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const logger = require('../utils/logger');

const WEBHOOK_BYPASS = bypassOptions('AISENSY_WEBHOOK');

const STATUS_RANK = { failed: 6, replied: 5, clicked: 4, read: 3, delivered: 2, sent: 1 };

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeTags(tags) {
  if (!tags) return [];
  const list = Array.isArray(tags) ? tags : String(tags).split(/[,;|]/);
  return [...new Set(list.map((t) => clean(t)).filter(Boolean))];
}

function normalizeAisensyStatus(raw) {
  const s = clean(raw).toLowerCase();
  if (!s) return 'sent';
  if (s.includes('fail') || s === 'undelivered') return 'failed';
  if (s.includes('repl')) return 'replied';
  if (s.includes('click')) return 'clicked';
  if (s === 'read' || s.includes('read')) return 'read';
  if (s.includes('deliver')) return 'delivered';
  if (s === 'sent' || s.includes('sent')) return 'sent';
  return 'sent';
}

function pickHigherStatus(current, incoming) {
  const cur = normalizeAisensyStatus(current);
  const next = normalizeAisensyStatus(incoming);
  return (STATUS_RANK[next] || 0) >= (STATUS_RANK[cur] || 0) ? next : cur;
}

function tagPrefix(campaignName, tag) {
  return `wa:${campaignName}:${tag}`;
}

async function registerWhatsappCampaign(campaignName, tags = []) {
  const name = clean(campaignName);
  if (!name) return null;
  const normalizedTags = normalizeTags(tags);
  return WhatsappCampaignRegistry.findOneAndUpdate(
    { campaignName: name },
    {
      $set: { lastSeenAt: new Date() },
      $addToSet: { tags: { $each: normalizedTags } },
      $setOnInsert: { campaignName: name, channel: 'whatsapp', firstSeenAt: new Date() },
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function applyWhatsappTagsToLead({ email, phone, campaignName, tags, status }) {
  const match = email ? { email } : phone ? { phone } : null;
  if (!match) return;
  const normalizedTags = normalizeTags(tags);
  const prefixed = normalizedTags.map((t) => tagPrefix(campaignName, t));
  const statusTag = `wa:${campaignName}:${normalizeAisensyStatus(status)}`;
  const update = {
    $set: {
      'metadata.lastWhatsappCampaign': campaignName,
      'metadata.lastWhatsappStatus': normalizeAisensyStatus(status),
      'metadata.lastWhatsappActionDate': new Date(),
    },
    $addToSet: { tags: { $each: [...prefixed, statusTag, `wa:campaign:${campaignName}`] } },
  };
  await Lead.updateMany(match, update).setOptions(WEBHOOK_BYPASS);
}

/**
 * Core sync: CampaignChannelOutcome + PersonIndex mail inlet + Lead tags + campaign registry.
 */
async function syncCampaignOutcome({
  campaignName,
  phone: rawPhone,
  name,
  email: rawEmail,
  status,
  failureReason,
  sentAt,
  tags = [],
  source = 'import',
  messageId,
  sourceFilename,
  metadata = {},
  dryRun = false,
}) {
  const campaign = clean(campaignName);
  const phone = normalizePhone(rawPhone);
  const email = normalizeEmail(rawEmail);
  const normalizedStatus = normalizeAisensyStatus(status);
  const normalizedTags = normalizeTags(tags);

  if (!campaign || !phone) {
    return { ok: false, reason: 'missing_campaign_or_phone' };
  }

  if (dryRun) {
    return { ok: true, dryRun: true, campaignName: campaign, phone, status: normalizedStatus, tags: normalizedTags };
  }

  await registerWhatsappCampaign(campaign, normalizedTags);

  const contact = await ContactService.mergeLegacyInletContact({
    name: name || 'Anonymous',
    email,
    phone,
    summary: {
      campaign,
      channel: 'whatsapp',
      deliveryStatus: normalizedStatus,
      failureReason: failureReason || undefined,
      sentAt: sentAt || undefined,
      tags: normalizedTags,
      sourceFilename: sourceFilename || undefined,
      lastWhatsappSyncAt: new Date(),
    },
    recordId: null,
  }, 'mail');

  const existing = await CampaignChannelOutcome.findOne({ campaignName: campaign, phone })
    .select('status tags metadata')
    .lean();
  const mergedStatus = pickHigherStatus(existing?.status, normalizedStatus);
  const mergedTags = [...new Set([...(existing?.tags || []), ...normalizedTags])];

  await CampaignChannelOutcome.findOneAndUpdate(
    { campaignName: campaign, phone },
    {
      $set: {
        personIndexId: contact?._id,
        campaignName: campaign,
        channel: 'whatsapp',
        status: mergedStatus,
        name: name || undefined,
        email: email || undefined,
        phone,
        failureReason: failureReason || undefined,
        sentAt: sentAt || undefined,
        sourceFilename: sourceFilename || undefined,
        tags: mergedTags,
        messageId: messageId || undefined,
        metadata: { ...(existing?.metadata || {}), ...metadata, lastSource: source },
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  await applyWhatsappTagsToLead({
    email: contact?.email || email,
    phone: contact?.phone || phone,
    campaignName: campaign,
    tags: mergedTags,
    status: mergedStatus,
  });

  if (messageId) {
    await AisensyCampaignSend.findOneAndUpdate(
      { messageId },
      {
        $set: {
          messageId,
          campaignName: campaign,
          phone,
          tags: mergedTags,
          status: mergedStatus,
          sentAt: sentAt || new Date(),
        },
      },
      { upsert: true }
    );
  }

  return {
    ok: true,
    campaignName: campaign,
    phone,
    status: mergedStatus,
    tags: mergedTags,
    personIndexId: contact?._id,
  };
}

async function recordOutboundSend({
  campaignName,
  destination,
  userName,
  tags = [],
  messageId,
  attributes,
}) {
  const phone = normalizePhone(destination);
  const normalizedTags = normalizeTags(tags);
  const attrs = attributes && typeof attributes === 'object' ? attributes : {};
  const attrTags = normalizeTags(attrs.tags || attrs.campaignTags);
  const allTags = [...new Set([...normalizedTags, ...attrTags])];

  await AisensyCampaignSend.create({
    campaignName: clean(campaignName),
    phone,
    userName: userName || undefined,
    tags: allTags,
    messageId: messageId || undefined,
    status: 'sent',
    sentAt: new Date(),
  }).catch((err) => {
    if (err?.code !== 11000) logger.warn('aisensyCampaignSync', 'send log failed', { error: err.message });
  });

  return syncCampaignOutcome({
    campaignName,
    phone,
    name: userName,
    status: 'sent',
    tags: allTags,
    source: 'api_send',
    messageId,
    sentAt: new Date(),
    metadata: { attributes: attrs },
  });
}

async function resolveCampaignForPhone(phone, messageId) {
  if (messageId) {
    const byMsg = await AisensyCampaignSend.findOne({ messageId }).lean();
    if (byMsg?.campaignName) {
      return { campaignName: byMsg.campaignName, tags: byMsg.tags || [] };
    }
  }
  const recent = await AisensyCampaignSend.findOne({ phone })
    .sort({ sentAt: -1 })
    .lean();
  if (recent?.campaignName) {
    return { campaignName: recent.campaignName, tags: recent.tags || [] };
  }
  const outcome = await CampaignChannelOutcome.findOne({ phone })
    .sort({ updatedAt: -1 })
    .lean();
  if (outcome?.campaignName) {
    return { campaignName: outcome.campaignName, tags: outcome.tags || [] };
  }
  return { campaignName: process.env.AISENSY_DEFAULT_CAMPAIGN || 'WhatsApp Campaign', tags: [] };
}

function extractFailureReason(errors) {
  if (!errors) return '';
  if (Array.isArray(errors)) {
    return errors.map((e) => e?.title || e?.message || e?.error_data?.details || JSON.stringify(e)).join('; ');
  }
  return clean(errors);
}

function parseFlatAisensyEvent(payload) {
  const phone = normalizePhone(
    payload.destination
    || payload.mobile
    || payload.mobileNumber
    || payload.phone
    || payload.recipient_id
    || payload.recipientId
    || payload.from
  );
  if (!phone) return null;

  const campaignName = clean(
    payload.campaignName
    || payload.campaign_name
    || payload.campaign
    || payload.metadata?.campaignName
  );
  const status = normalizeAisensyStatus(
    payload.status
    || payload.deliveryStatus
    || payload.messageStatus
    || payload.event
  );
  const tags = normalizeTags(payload.tags || payload.campaignTags || payload.metadata?.tags);
  const messageId = clean(payload.messageId || payload.message_id || payload.id || payload.wamid);

  return {
    campaignName,
    phone,
    name: clean(payload.userName || payload.name),
    email: normalizeEmail(payload.email),
    status,
    failureReason: extractFailureReason(payload.errors || payload.failureReason || payload.error),
    sentAt: payload.sentAt || payload.timestamp ? new Date(payload.sentAt || Number(payload.timestamp) * 1000) : new Date(),
    tags,
    messageId,
    metadata: { rawType: 'flat' },
  };
}

function parseMetaWhatsappStatuses(body) {
  const events = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      for (const statusRow of value?.statuses || []) {
        const phone = normalizePhone(statusRow.recipient_id);
        if (!phone) continue;
        const messageId = clean(statusRow.id);
        const status = normalizeAisensyStatus(statusRow.status);
        const failureReason = extractFailureReason(statusRow.errors);
        const sentAt = statusRow.timestamp
          ? new Date(Number(statusRow.timestamp) * 1000)
          : new Date();
        events.push({
          campaignName: '',
          phone,
          status,
          failureReason,
          sentAt,
          messageId,
          tags: [],
          metadata: { rawType: 'meta_status', conversation: statusRow.conversation },
        });
      }
    }
  }
  return events;
}

async function parseAisensyWebhookPayload(body) {
  if (!body || typeof body !== 'object') return [];

  if (Array.isArray(body)) {
    return (await Promise.all(body.map(async (row) => {
      const flat = parseFlatAisensyEvent(row);
      if (!flat) return null;
      if (!flat.campaignName) {
        const resolved = await resolveCampaignForPhone(flat.phone, flat.messageId);
        flat.campaignName = resolved.campaignName;
        flat.tags = [...new Set([...(flat.tags || []), ...(resolved.tags || [])])];
      }
      return flat;
    }))).filter(Boolean);
  }

  if (body.object === 'whatsapp_business_account' || body.entry) {
    const events = parseMetaWhatsappStatuses(body);
    return Promise.all(events.map(async (evt) => {
      const resolved = await resolveCampaignForPhone(evt.phone, evt.messageId);
      return {
        ...evt,
        campaignName: resolved.campaignName,
        tags: resolved.tags,
      };
    }));
  }

  const flat = parseFlatAisensyEvent(body);
  if (!flat) return [];
  if (!flat.campaignName) {
    const resolved = await resolveCampaignForPhone(flat.phone, flat.messageId);
    flat.campaignName = resolved.campaignName;
    flat.tags = [...new Set([...(flat.tags || []), ...(resolved.tags || [])])];
  }
  return [flat];
}

async function processAisensyWebhook(body) {
  const events = await parseAisensyWebhookPayload(body);
  const stats = { received: events.length, synced: 0, skipped: 0, errors: 0, campaigns: new Set() };

  for (const evt of events) {
    try {
      const result = await syncCampaignOutcome({
        ...evt,
        source: 'webhook',
      });
      if (result.ok) {
        stats.synced += 1;
        stats.campaigns.add(result.campaignName);
      } else {
        stats.skipped += 1;
      }
    } catch (error) {
      stats.errors += 1;
      logger.error('aisensyCampaignSync', 'webhook row failed', { error: error.message, phone: evt.phone });
    }
  }

  return {
    ...stats,
    campaigns: [...stats.campaigns],
  };
}

async function listCampaignSummaries() {
  const rows = await CampaignChannelOutcome.aggregate([
    {
      $group: {
        _id: { campaignName: '$campaignName', status: '$status' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.campaignName': 1, '_id.status': 1 } },
  ]);

  const registries = await WhatsappCampaignRegistry.find({})
    .select('campaignName tags firstSeenAt lastSeenAt')
    .lean();
  const tagByCampaign = new Map(registries.map((r) => [r.campaignName, r.tags || []]));

  const campaigns = new Map();
  for (const row of rows) {
    const name = row._id.campaignName;
    if (!campaigns.has(name)) {
      campaigns.set(name, { campaignName: name, total: 0, byStatus: {}, tags: tagByCampaign.get(name) || [] });
    }
    const entry = campaigns.get(name);
    entry.byStatus[row._id.status] = row.count;
    entry.total += row.count;
  }

  for (const reg of registries) {
    if (!campaigns.has(reg.campaignName)) {
      campaigns.set(reg.campaignName, {
        campaignName: reg.campaignName,
        total: 0,
        byStatus: {},
        tags: reg.tags || [],
        firstSeenAt: reg.firstSeenAt,
        lastSeenAt: reg.lastSeenAt,
      });
    }
  }

  return [...campaigns.values()];
}

async function listOutcomesForPerson({ personIndexId, phone, email }) {
  const clauses = [];
  if (personIndexId) clauses.push({ personIndexId });
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) clauses.push({ phone: normalizedPhone });
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) clauses.push({ email: normalizedEmail });
  if (!clauses.length) return [];
  return CampaignChannelOutcome.find({ $or: clauses })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
}

module.exports = {
  normalizeAisensyStatus,
  normalizeTags,
  syncCampaignOutcome,
  recordOutboundSend,
  parseAisensyWebhookPayload,
  processAisensyWebhook,
  registerWhatsappCampaign,
  listCampaignSummaries,
  listOutcomesForPerson,
  pickHigherStatus,
};
