const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');

exports.getCumulativeMetrics = async (req, res) => {
  try {
    const aggregateData = await Campaign.aggregate([
      {
        $group: {
          _id: "$eventTag",
          totalSent: { $sum: "$metrics.totalSent" },
          totalOpens: { $sum: "$metrics.opened" },
          totalClicks: { $sum: "$metrics.clicked" }
        }
      },
      {
        $project: {
          eventTag: { $ifNull: ["$_id", "General"] },
          totalSent: 1,
          totalOpens: 1,
          totalClicks: 1,
          ctr: { 
            $cond: [ { $eq: ["$totalSent", 0] }, 0, { $round: [{ $multiply: [{ $divide: ["$totalClicks", "$totalSent"] }, 100] }, 1] } ] 
          },
          openRate: { 
            $cond: [ { $eq: ["$totalSent", 0] }, 0, { $round: [{ $multiply: [{ $divide: ["$totalOpens", "$totalSent"] }, 100] }, 1] } ] 
          }
        }
      },
      { $sort: { ctr: -1 } }
    ]);

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
