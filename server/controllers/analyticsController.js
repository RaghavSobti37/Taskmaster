const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const Lead = require('../models/Lead');

exports.getCumulativeMetrics = async (req, res) => {
  try {
    const userId = req.user._id;
    const coreCamps = await Campaign.find({ createdBy: userId }).lean();
    const mailCamps = await MailCampaign.find({ createdBy: userId }).lean();
    const allCamps = [...coreCamps, ...mailCamps];

    const tagMap = {};
    for (const c of allCamps) {
      const tag = c.eventTag || 'General';
      if (!tagMap[tag]) {
        tagMap[tag] = { eventTag: tag, totalSent: 0, totalOpens: 0, totalClicks: 0 };
      }
      const sent = c.metrics?.totalSent || c.stats?.sent || 0;
      const opened = c.metrics?.opened || c.stats?.opened || 0;
      const clicked = c.metrics?.clicked || c.stats?.clicked || 0;

      tagMap[tag].totalSent += sent;
      tagMap[tag].totalOpens += opened;
      tagMap[tag].totalClicks += clicked;
    }

    const aggregateData = Object.values(tagMap).map(item => {
      const openRate = item.totalSent > 0 ? Math.round((item.totalOpens / item.totalSent) * 100) : (item.totalOpens > 0 ? 100 : 0);
      const ctr = item.totalSent > 0 ? Math.round((item.totalClicks / item.totalSent) * 100) : (item.totalClicks > 0 ? 100 : 0);
      return { ...item, openRate, ctr };
    }).sort((a, b) => b.totalSent - a.totalSent);

    const dynamicBreakdown = await Lead.aggregate([
      { $match: { status: { $in: ['engaged', 'active'] } } },
      {
        $group: {
          _id: { location: { $ifNull: ["$location", { $ifNull: ["$city", "Unknown"] }] }, artistType: { $ifNull: ["$artistType", "Full Time"] } },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          location: "$_id.location",
          artistType: "$_id.artistType",
          count: 1,
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({ aggregateData, dynamicBreakdown });
  } catch (error) {
    console.error('Cumulative metrics error:', error);
    res.status(500).json({ error: error.message });
  }
};
