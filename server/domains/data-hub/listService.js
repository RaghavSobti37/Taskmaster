const OutsourcedRecord = require('../../models/OutsourcedRecord');
const CampaignChannelOutcome = require('../../models/CampaignChannelOutcome');
const PersonIndex = require('../../models/PersonIndex');
const { DATA_INLETS, INLET_KEYS, buildInletGroups } = require('../../../shared/dataInlets');
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
      return { imlPriority: -1, updatedAt: dir };
    case 'name':
      return { name: dir };
    case 'lastActivity':
    case 'lastActivityAt':
      return { imlPriority: -1, lastActivityAt: dir };
    default:
      return isHubViewActive() ? { imlPriority: -1, lastActivityAt: -1 } : { imlPriority: -1, updatedAt: -1 };
  }
}

function isHavellsFolder(folder) {
  return typeof folder === 'string' && folder.startsWith('havells_');
}

async function resolveListModel(folder, HubModel) {
  // ponytail: Havells import lands on PersonIndex first; hub sync is async
  if (isHavellsFolder(folder)) return PersonIndex;
  return HubModel;
}

async function countFolder(key, HubModel) {
  if (isHavellsFolder(key)) {
    return PersonIndex.countDocuments(buildFolderQuery(key)).setOptions(CONTACT_BYPASS);
  }
  return HubModel.countDocuments(buildFolderQuery(key)).setOptions(CONTACT_BYPASS);
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
  const HubModel = await resolveListModel(folder, await resolveHubModel());

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
    const identityClauses = [];
    if (campaign && campaign !== 'all') {
      const [outRows, waRows] = await Promise.all([
        OutsourcedRecord.find({ campaign }).select('email phone').lean(),
        CampaignChannelOutcome.find({ campaignName: campaign }).select('email phone').lean(),
      ]);
      const emails = [...outRows, ...waRows].map((r) => r.email).filter(Boolean);
      const phones = [...outRows, ...waRows].map((r) => r.phone).filter(Boolean);
      if (emails.length || phones.length) {
        identityClauses.push({
          $or: [
            ...(emails.length ? [{ email: { $in: emails } }] : []),
            ...(phones.length ? [{ phone: { $in: phones } }] : []),
          ],
        });
      } else {
        return { data: [], total: 0, page, pages: 0 };
      }
    }
    if (originSource && originSource !== 'all') {
      const outRows = await OutsourcedRecord.find({ originSource }).select('email phone').lean();
      const emails = outRows.map((r) => r.email).filter(Boolean);
      const phones = outRows.map((r) => r.phone).filter(Boolean);
      if (!emails.length && !phones.length) {
        return { data: [], total: 0, page, pages: 0 };
      }
      identityClauses.push({
        $or: [
          ...(emails.length ? [{ email: { $in: emails } }] : []),
          ...(phones.length ? [{ phone: { $in: phones } }] : []),
        ],
      });
    }
    query.$and = query.$and || [];
    query.$and.push(...identityClauses);
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
      counts[key] = await countFolder(key, HubModel);
    })
  );

  const folders = folderKeys.map((key) => ({
    key,
    label: DATA_INLETS[key]?.label || key,
    count: counts[key] || 0,
  }));

  const data = { folders, counts, groups: buildInletGroups(counts) };
  setFolderCache(data);
  return data;
}

module.exports = {
  listPeople,
  getFolderCounts,
};
