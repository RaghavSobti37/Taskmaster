const PersonIndex = require('../../models/PersonIndex');
const PersonHubView = require('../../models/PersonHubView');
const { dedupeInletEntries } = require('../../../shared/dataInlets');
const { CONTACT_BYPASS } = require('./folderCache');

async function repairDuplicateInlets({ onProgress } = {}) {
  let fixed = 0;
  const contacts = await PersonIndex.find({ inlets: { $exists: true, $not: { $size: 0 } } })
    .setOptions(CONTACT_BYPASS)
    .select('inlets')
    .lean();
  for (const contact of contacts) {
    const deduped = dedupeInletEntries(contact.inlets || []);
    if (deduped.length === (contact.inlets || []).length) continue;
    await PersonIndex.updateOne(
      { _id: contact._id },
      {
        $set: {
          inlets: deduped,
          inletCount: deduped.length,
          isMultiInlet: deduped.length >= 2,
        },
      }
    ).setOptions(CONTACT_BYPASS);
    fixed += 1;
  }

  const hubViews = await PersonHubView.find({ inletKeys: { $exists: true, $not: { $size: 0 } } })
    .setOptions(CONTACT_BYPASS)
    .select('inletKeys')
    .lean();
  for (const view of hubViews) {
    const keys = [...new Set((view.inletKeys || []).filter(Boolean))];
    if (keys.length === (view.inletKeys || []).length) continue;
    await PersonHubView.updateOne(
      { _id: view._id },
      {
        $set: {
          inletKeys: keys,
          inletCount: keys.length,
          isMultiInlet: keys.length >= 2,
        },
      }
    ).setOptions(CONTACT_BYPASS);
    fixed += 1;
  }

  if (fixed && onProgress) onProgress(`repaired duplicate inlets on ${fixed} contacts`);
  return fixed;
}

module.exports = {
  repairDuplicateInlets,
};
