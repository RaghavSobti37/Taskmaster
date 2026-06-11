const OutsourcedRecord = require('../../models/OutsourcedRecord');
const { DATA_INLETS, INLET_KEYS } = require('../../../shared/dataInlets');
const {
  CONTACT_BYPASS,
  resolveHubModel,
  getFolderCache,
  setFolderCache,
  isHubViewActive,
} = require('./folderCache');
const {
  buildFolderQuery,
  mapHubRow,
  escapeRegExp,
} = require('./queryHelpers');

function resolveSort(sort, order) {
  const dir = order === 'asc' ? 1 : -1;
  switch (sort) {
    case 'updated':
    case 'updatedAt':
      return { updatedAt: dir };
    case 'name':
      return { name: dir };
    case 'lastActivity':
    case 'lastActivityAt':
      return { lastActivityAt: dir };
    default:
      return isHubViewActive() ? { lastActivityAt: -1 } : { updatedAt: -1 };
  }
}

async function listPeople({
  folder = 'all',
  search = '',
  page = 1,
  limit = 25,
  campaign,
  originSource,
  emailStatus,
  sort,
  order,
}) {
  const query = buildFolderQuery(folder);
  const HubModel = await resolveHubModel();

  if (search) {
    const escaped = escapeRegExp(search);
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  if (emailStatus && emailStatus !== 'all') {
    query.emailStatus = emailStatus;
  }

  if ((campaign && campaign !== 'all') || (originSource && originSource !== 'all')) {
    const outFilter = {};
    if (campaign && campaign !== 'all') outFilter.campaign = campaign;
    if (originSource && originSource !== 'all') outFilter.originSource = originSource;
    const outRows = await OutsourcedRecord.find(outFilter).select('email phone').lean();
    const emails = outRows.map((r) => r.email).filter(Boolean);
    const phones = outRows.map((r) => r.phone).filter(Boolean);
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        ...(emails.length ? [{ email: { $in: emails } }] : []),
        ...(phones.length ? [{ phone: { $in: phones } }] : []),
      ],
    });
    if (!query.$and[query.$and.length - 1].$or.length) {
      return { data: [], total: 0, page, pages: 0 };
    }
  }

  const skip = (page - 1) * limit;
  const sortField = resolveSort(sort, order);
  const [total, data] = await Promise.all([
    HubModel.countDocuments(query).setOptions(CONTACT_BYPASS),
    HubModel.find(query)
      .setOptions(CONTACT_BYPASS)
      .sort(sortField)
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    data: data.map(mapHubRow),
    total,
    page,
    pages: Math.ceil(total / limit) || 0,
  };
}

async function getFolderCounts() {
  const now = Date.now();
  const cached = getFolderCache();
  if (cached.data && cached.expiresAt > now) {
    return cached.data;
  }

  const HubModel = await resolveHubModel();
  const folderKeys = ['all', ...INLET_KEYS, 'loyal'];
  const counts = {};
  await Promise.all(
    folderKeys.map(async (key) => {
      counts[key] = await HubModel.countDocuments(buildFolderQuery(key)).setOptions(CONTACT_BYPASS);
    })
  );

  const folders = folderKeys.map((key) => ({
    key,
    label: DATA_INLETS[key]?.label || key,
    count: counts[key] || 0,
  }));

  const data = { folders, counts };
  setFolderCache(data);
  return data;
}

module.exports = {
  listPeople,
  getFolderCounts,
};
