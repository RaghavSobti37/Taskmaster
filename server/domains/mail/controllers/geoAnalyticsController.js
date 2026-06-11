const { getGeoCampaignAnalytics } = require('../services/mailEventQueryService');

const getGeoCampaignAnalyticsHandler = async (req, res) => {
  try {
    const geoMetrics = await getGeoCampaignAnalytics();
    res.status(200).json(geoMetrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getGeoCampaignAnalytics: getGeoCampaignAnalyticsHandler,
};
