const mongoose = require('mongoose');
const Person = require('../../models/Person');
const PersonIndex = require('../../models/PersonIndex');
const PersonHubView = require('../../models/PersonHubView');
const PersonIdentifier = require('../../models/PersonIdentifier');
const PersonCommunicationProfile = require('../../models/PersonCommunicationProfile');
const PersonSourceLink = require('../../models/PersonSourceLink');
const { CONTACT_BYPASS, clearFolderCache, resetHubModelCache } = require('./folderCache');

const MAX_BULK_DELETE = 100;

function toObjectIds(rawIds = []) {
  return [...new Set(rawIds.map(String).filter(Boolean))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .slice(0, MAX_BULK_DELETE)
    .map((id) => new mongoose.Types.ObjectId(id));
}

/**
 * Remove Person golden records + hub index rows for selected Data Hub list ids.
 * Source inlet records are untouched — reconcile may recreate hub rows.
 */
async function deletePeopleByIds(rawIds = []) {
  const ids = toObjectIds(rawIds);
  if (!ids.length) return { deleted: 0, requested: rawIds?.length || 0 };

  const [hubRows, indexRows] = await Promise.all([
    PersonHubView.find({ personId: { $in: ids } }).setOptions(CONTACT_BYPASS).select('personId email phone').lean(),
    PersonIndex.find({ _id: { $in: ids } }).setOptions(CONTACT_BYPASS).select('email phone').lean(),
  ]);

  const personIdSet = new Set(ids.map((id) => String(id)));
  hubRows.forEach((row) => personIdSet.add(String(row.personId)));

  const identityClauses = [];
  for (const row of [...hubRows, ...indexRows]) {
    if (row.email) identityClauses.push({ email: row.email });
    if (row.phone) identityClauses.push({ phone: row.phone });
  }

  const personObjectIds = [...personIdSet].map((id) => new mongoose.Types.ObjectId(id));

  await Promise.all([
    Person.deleteMany({ _id: { $in: personObjectIds } }).setOptions(CONTACT_BYPASS),
    PersonHubView.deleteMany({ personId: { $in: personObjectIds } }).setOptions(CONTACT_BYPASS),
    PersonIndex.deleteMany({ _id: { $in: ids } }).setOptions(CONTACT_BYPASS),
    identityClauses.length
      ? PersonIndex.deleteMany({ $or: identityClauses }).setOptions(CONTACT_BYPASS)
      : Promise.resolve(),
    PersonCommunicationProfile.deleteMany({ personId: { $in: personObjectIds } }).setOptions(CONTACT_BYPASS),
    PersonSourceLink.deleteMany({ personId: { $in: personObjectIds } }).setOptions(CONTACT_BYPASS),
    PersonIdentifier.deleteMany({ personId: { $in: personObjectIds } }).setOptions(CONTACT_BYPASS),
  ]);

  clearFolderCache();
  resetHubModelCache();

  return { deleted: ids.length, requested: rawIds.length };
}

module.exports = {
  MAX_BULK_DELETE,
  deletePeopleByIds,
};
