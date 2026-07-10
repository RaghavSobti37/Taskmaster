const ExlyBooking = require('../../../models/ExlyBooking');
const OutsourcedRecord = require('../../../models/OutsourcedRecord');

async function buildCommunityAnalytics(result, { total }) {
  const [exlyCommunity, outCommunity] = await Promise.all([
    ExlyBooking.countDocuments({ offeringTitle: { $regex: /community/i } }),
    OutsourcedRecord.countDocuments({
      $or: [
        { campaign: { $regex: /community/i } },
        { originSource: { $regex: /community/i } },
      ],
    }),
  ]);
  result.kpis = [
    { key: 'people', label: 'Community People', value: total },
    { key: 'exly', label: 'Exly Community Bookings', value: exlyCommunity },
    { key: 'outsourced', label: 'Outsourced Community Rows', value: outCommunity },
    { key: 'combined', label: 'Combined Records', value: exlyCommunity + outCommunity },
  ];
  result.topOfferings = await ExlyBooking.aggregate([
    { $match: { offeringTitle: { $regex: /community/i } } },
    { $group: { _id: '$offeringTitle', count: { $sum: 1 }, revenue: { $sum: '$pricePaid' } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
}

module.exports = {
  buildCommunityAnalytics,
};
