const { DATA_INLETS } = require('../../../../shared/dataInlets');
const { countSinceDate, buildFolderQuery } = require('../queryHelpers');
const { CONTACT_BYPASS, mapHubInletKey, isHubViewActive } = require('../folderCache');

async function buildUnsubscribedAnalytics(result, { total, weekAgo, HubModel, query }) {
  const allMatch = buildFolderQuery('all');
  const allPeople = await HubModel.countDocuments(allMatch).setOptions(CONTACT_BYPASS);
  const [byReason, byInlet, recentUnsubs] = isHubViewActive()
    ? await Promise.all([
      HubModel.aggregate([
        { $match: query },
        { $group: { _id: '$unsubscribeReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).option(CONTACT_BYPASS),
      HubModel.aggregate([
        { $match: query },
        { $unwind: '$inletKeys' },
        { $group: { _id: '$inletKeys', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).option(CONTACT_BYPASS),
      countSinceDate(HubModel, query, weekAgo, 'updatedAt'),
    ])
    : await Promise.all([
      HubModel.aggregate([
        { $match: query },
        { $group: { _id: '$unsubscribeReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).option(CONTACT_BYPASS),
      HubModel.aggregate([
        { $match: query },
        { $unwind: '$inlets' },
        { $group: { _id: '$inlets.key', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).option(CONTACT_BYPASS),
      countSinceDate(HubModel, query, weekAgo, 'updatedAt'),
    ]);
  result.byReason = byReason;
  result.byInlet = byInlet.map((r) => {
    const folderKey = isHubViewActive() ? mapHubInletKey(r._id) : r._id;
    return { label: DATA_INLETS[folderKey]?.label || r._id, count: r.count };
  });
  result.kpis = [
    { key: 'total', label: 'Unsubscribed', value: total },
    { key: 'recent', label: 'Updated This Week', value: recentUnsubs },
    { key: 'reasons', label: 'Distinct Reasons', value: byReason.filter((r) => r._id).length },
    {
      key: 'rate',
      label: '% of All People',
      value: allPeople ? Math.round((total / allPeople) * 100) : 0,
      format: 'percent',
    },
  ];
}

module.exports = {
  buildUnsubscribedAnalytics,
};
