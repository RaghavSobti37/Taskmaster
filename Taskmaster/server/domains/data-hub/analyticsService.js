const { DATA_INLETS } = require('../../../shared/dataInlets');
const {
  CONTACT_BYPASS,
  resolveHubModel,
  mapHubInletKey,
  isHubViewActive,
} = require('./folderCache');
const {
  countSinceDate,
  aggregateWeeklyGrowth,
  aggregateInletBreakdown,
  buildFolderQuery,
} = require('./queryHelpers');
const { ANALYTICS_BUILDERS } = require('./processors');

function weekAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function monthAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

async function getOverlapMatrix() {
  const HubModel = await resolveHubModel();
  const match = buildFolderQuery('loyal');
  const multi = await HubModel.find(match)
    .setOptions(CONTACT_BYPASS)
    .select(isHubViewActive() ? 'inletKeys' : 'inlets')
    .lean();
  const pairCounts = {};

  for (const c of multi) {
    const keys = isHubViewActive()
      ? [...new Set((c.inletKeys || []).map(mapHubInletKey))].sort()
      : [...new Set((c.inlets || []).map((i) => i.key))].sort();
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pair = `${keys[i]}+${keys[j]}`;
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
    }
  }

  return Object.entries(pairCounts)
    .map(([pair, count]) => {
      const [a, b] = pair.split('+');
      return {
        a,
        b,
        labelA: DATA_INLETS[a]?.label || a,
        labelB: DATA_INLETS[b]?.label || b,
        count,
      };
    })
    .sort((x, y) => y.count - x.count);
}

async function getGlobalAnalytics() {
  const HubModel = await resolveHubModel();
  const match = buildFolderQuery('all');
  const growthSince = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
  const loyalQuery = buildFolderQuery('loyal');

  const [
    totalPeople,
    emailHealth,
    inletBreakdown,
    newThisWeek,
    overlapPairs,
    loyalCount,
    growth,
  ] = await Promise.all([
    HubModel.countDocuments(match).setOptions(CONTACT_BYPASS),
    HubModel.aggregate([
      { $match: match },
      { $group: { _id: '$emailStatus', count: { $sum: 1 } } },
    ]).option(CONTACT_BYPASS),
    aggregateInletBreakdown(HubModel, match),
    countSinceDate(HubModel, match, weekAgo(), isHubViewActive() ? 'firstSeenAt' : 'createdAt'),
    getOverlapMatrix(),
    HubModel.countDocuments(loyalQuery).setOptions(CONTACT_BYPASS),
    aggregateWeeklyGrowth(HubModel, match, growthSince, isHubViewActive() ? 'firstSeenAt' : 'createdAt'),
  ]);

  return {
    folder: 'all',
    label: DATA_INLETS.all.label,
    totalPersonIndexs: totalPeople,
    newThisWeek,
    kpis: [
      { key: 'total', label: 'Unique People', value: totalPeople },
      { key: 'newWeek', label: 'New This Week', value: newThisWeek },
      { key: 'loyal', label: 'Loyal (2+ Inlets)', value: loyalCount },
      {
        key: 'unsubRate',
        label: 'Unsub Rate',
        value: totalPeople
          ? Math.round(((emailHealth.find((e) => e._id === 'Unsubscribed')?.count || 0) / totalPeople) * 100)
          : 0,
        format: 'percent',
      },
    ],
    emailHealth: emailHealth.map((r) => ({ status: r._id || 'Unknown', count: r.count })),
    inletBreakdown: inletBreakdown.map((r) => {
      const folderKey = isHubViewActive() ? mapHubInletKey(r._id) : r._id;
      return {
        key: folderKey,
        label: DATA_INLETS[folderKey]?.label || r._id,
        count: r.count,
      };
    }),
    growth,
    overlap: overlapPairs,
    loyalCount,
  };
}

async function getLoyalAnalytics() {
  const HubModel = await resolveHubModel();
  const match = buildFolderQuery('loyal');
  const total = await HubModel.countDocuments(match).setOptions(CONTACT_BYPASS);
  const overlap = await getOverlapMatrix();

  const inletDistribution = await HubModel.aggregate([
    { $match: match },
    { $group: { _id: '$inletCount', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).option(CONTACT_BYPASS);

  const topInletsAmongLoyal = isHubViewActive()
    ? await HubModel.aggregate([
      { $match: match },
      { $unwind: '$inletKeys' },
      { $group: { _id: '$inletKeys', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).option(CONTACT_BYPASS)
    : await HubModel.aggregate([
      { $match: match },
      { $unwind: '$inlets' },
      { $group: { _id: '$inlets.key', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).option(CONTACT_BYPASS);

  const avgInlets = total
    ? (await HubModel.aggregate([
      { $match: match },
      { $group: { _id: null, avg: { $avg: '$inletCount' } } },
    ]).option(CONTACT_BYPASS))[0]?.avg || 0
    : 0;

  const newLoyalThisWeek = await countSinceDate(HubModel, match, weekAgo(), 'updatedAt');

  return {
    folder: 'loyal',
    label: DATA_INLETS.loyal.label,
    total,
    kpis: [
      { key: 'total', label: 'Loyal Customers', value: total },
      { key: 'avgInlets', label: 'Avg Inlets / Person', value: Math.round(avgInlets * 10) / 10 },
      { key: 'newWeek', label: 'Updated This Week', value: newLoyalThisWeek },
      { key: 'topPair', label: 'Top Overlap Pair', value: overlap[0] ? `${overlap[0].count}` : 0 },
    ],
    overlap,
    inletDistribution: inletDistribution.map((r) => ({
      label: `${r._id} inlets`,
      count: r.count,
    })),
    topInletsAmongLoyal: topInletsAmongLoyal.map((r) => {
      const folderKey = isHubViewActive() ? mapHubInletKey(r._id) : r._id;
      return {
        label: DATA_INLETS[folderKey]?.label || r._id,
        count: r.count,
      };
    }),
  };
}

async function getInletAnalytics(folder) {
  const HubModel = await resolveHubModel();
  const query = buildFolderQuery(folder);
  const total = await HubModel.countDocuments(query).setOptions(CONTACT_BYPASS);

  const result = { folder, total, label: DATA_INLETS[folder]?.label || folder, kpis: [] };
  const ctx = {
    total,
    weekAgo: weekAgo(),
    monthAgo: monthAgo(),
    HubModel,
    query,
  };

  const builder = ANALYTICS_BUILDERS[folder];
  if (builder) {
    await builder(result, ctx);
  }

  if (!result.kpis.length) {
    result.kpis = [{ key: 'total', label: 'In Folder', value: total }];
  }

  return result;
}

async function getAnalytics(folder = 'all') {
  if (folder === 'all') return getGlobalAnalytics();
  if (folder === 'loyal') return getLoyalAnalytics();
  return getInletAnalytics(folder);
}

module.exports = {
  getAnalytics,
  getGlobalAnalytics,
  getLoyalAnalytics,
  getInletAnalytics,
  getOverlapMatrix,
};
