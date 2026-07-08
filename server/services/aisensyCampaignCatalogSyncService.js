const WhatsappCampaignRegistry = require('../models/WhatsappCampaignRegistry');
const { listAllProjectCampaigns } = require('./aisensyProjectApiService');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const SYNC_BYPASS = bypassOptions('AISENSY_CATALOG_SYNC');

function inferTagsFromCampaignName(name = '') {
  const lower = String(name).toLowerCase();
  const tags = [];
  if (lower.includes('havells')) tags.push('havells');
  if (lower.includes('dumka')) tags.push('dumka');
  if (lower.includes('indore')) tags.push('indore');
  if (lower.includes('delhi')) tags.push('delhi');
  if (lower.includes('artist')) tags.push('artist');
  if (lower.includes('failed audience')) tags.push('failed_audience');
  return tags;
}

async function findExistingRegistry(campaign) {
  const campaignName = String(campaign?.name || '').trim();
  const aisensyId = campaign?.id ? String(campaign.id) : '';
  if (aisensyId) {
    const byId = await WhatsappCampaignRegistry.findOne({ 'metadata.aisensyId': aisensyId })
      .select('_id campaignName metadata')
      .lean()
      .setOptions(SYNC_BYPASS);
    if (byId) return byId;
  }
  if (!campaignName) return null;
  return WhatsappCampaignRegistry.findOne({ campaignName })
    .select('_id campaignName metadata')
    .lean()
    .setOptions(SYNC_BYPASS);
}

async function upsertCampaignFromAisensy(campaign, { dryRun = false } = {}) {
  const campaignName = String(campaign?.name || '').trim();
  if (!campaignName) return { ok: false, reason: 'missing_name' };

  const existing = await findExistingRegistry(campaign);
  const tags = inferTagsFromCampaignName(campaignName);
  const metadata = {
    aisensyId: campaign.id,
    aisensyType: campaign.type,
    aisensyStatus: campaign.status,
    audienceSize: campaign.audience_size ?? null,
    messageType: campaign.message_type,
    syncedAt: new Date(),
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      campaignName,
      tags,
      metadata,
      action: existing ? 'update' : 'create',
    };
  }

  const filter = existing?._id ? { _id: existing._id } : { campaignName };
  const doc = await WhatsappCampaignRegistry.findOneAndUpdate(
    filter,
    {
      $set: {
        campaignName,
        lastSeenAt: new Date(),
        metadata,
      },
      $addToSet: { tags: { $each: tags } },
      $setOnInsert: {
        channel: 'whatsapp',
        firstSeenAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).setOptions(SYNC_BYPASS);

  const action = existing ? 'updated' : 'created';
  return { ok: true, action, campaignName, registryId: doc?._id, metadata };
}

/**
 * Pull campaign catalog from AiSensy Project API into WhatsappCampaignRegistry.
 * Per-recipient delivery rows are NOT available on this API — use CSV import or webhooks.
 */
async function syncAisensyCampaignCatalog({ dryRun = false } = {}) {
  const campaigns = await listAllProjectCampaigns();
  const stats = {
    fetched: campaigns.length,
    created: 0,
    updated: 0,
    upserted: 0,
    skipped: 0,
    dryRun,
    campaignTypes: { BROADCAST: 0, API: 0, other: 0 },
  };

  for (const campaign of campaigns) {
    const type = String(campaign?.type || '').toUpperCase();
    if (type === 'BROADCAST') stats.campaignTypes.BROADCAST += 1;
    else if (type === 'API') stats.campaignTypes.API += 1;
    else stats.campaignTypes.other += 1;

    const result = await upsertCampaignFromAisensy(campaign, { dryRun });
    if (result.ok) {
      stats.upserted += 1;
      if (result.action === 'created' || result.action === 'create') stats.created += 1;
      else if (result.action === 'updated' || result.action === 'update') stats.updated += 1;
    } else {
      stats.skipped += 1;
    }
  }

  return stats;
}

module.exports = {
  inferTagsFromCampaignName,
  findExistingRegistry,
  upsertCampaignFromAisensy,
  syncAisensyCampaignCatalog,
};
