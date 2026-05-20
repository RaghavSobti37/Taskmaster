const MailEvent = require('../models/MailEvent');

const getGeoCampaignAnalytics = async (req, res) => {
  try {
    const geoMetrics = await MailEvent.aggregate([
      { $match: { eventType: { $in: ['Open', 'Click'] } } },
      {
        $group: {
          _id: { country: "$location.country", city: "$location.city" },
          totalOpens: { $sum: { $cond: [{ $eq: ["$eventType", "Open"] }, 1, 0] } },
          totalClicks: { $sum: { $cond: [{ $eq: ["$eventType", "Click"] }, 1, 0] } }
        }
      },
      { $sort: { totalClicks: -1, totalOpens: -1 } },
      { $limit: 20 }
    ]);

    res.status(200).json(geoMetrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getGeoCampaignAnalytics
};
