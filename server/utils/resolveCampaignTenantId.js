const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const BYPASS = bypassOptions('CAMPAIGN_TENANT_RESOLVE');

/**
 * Resolve tenant for campaign workers/webhooks when AsyncLocalStorage has no request context.
 */
async function resolveCampaignTenantId(campaign) {
  if (!campaign) return null;
  if (campaign.tenantId) {
    return campaign.tenantId._id || campaign.tenantId;
  }

  const createdBy = campaign.createdBy?._id || campaign.createdBy;
  if (createdBy) {
    const User = require('../models/User');
    const user = await User.findById(createdBy).select('tenantId').setOptions(BYPASS).lean();
    if (user?.tenantId) return user.tenantId;
  }

  const Tenant = require('../models/Tenant');
  const tenant = await Tenant.findOne({}).select('_id').setOptions(BYPASS).lean();
  return tenant?._id ?? null;
}

module.exports = { resolveCampaignTenantId };
