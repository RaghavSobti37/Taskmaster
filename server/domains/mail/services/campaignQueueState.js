const stoppedCampaignIds = new Set();

const isCampaignStopped = (campaignId) => stoppedCampaignIds.has(String(campaignId));

const markCampaignStopped = (campaignId) => {
  stoppedCampaignIds.add(String(campaignId));
};

const clearCampaignStopped = (campaignId) => {
  stoppedCampaignIds.delete(String(campaignId));
};

module.exports = {
  isCampaignStopped,
  markCampaignStopped,
  clearCampaignStopped,
};
