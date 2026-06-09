/**
 * Wipe sheet-sourced Artist Path responses and re-import from HolySheet
 * with per-email identity + stable row ids.
 *
 * Usage:
 *   node server/scripts/repairArtistPathImport.js
 *   node server/scripts/repairArtistPathImport.js --prod
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const PersonHubView = require('../models/PersonHubView');
const PersonHubBuilder = require('../services/PersonHubBuilder');
const { syncFromSheet } = require('../services/artistPathImportService');

const useProd = process.argv.includes('--prod');

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  const label = useProd ? 'prod' : 'local';
  console.log(`[repairArtistPath] ${label} — ${mongoose.connection.db.databaseName}`);

  const removed = await ArtistPathResponse.deleteMany({ source: 'artist_path_sheet' })
    .setOptions({ bypassTenant: true });
  console.log(`removed ${removed.deletedCount} sheet responses`);

  const result = await syncFromSheet();
  console.log('reimport:', result);

  const personIds = await ArtistPathResponse.distinct('personId').setOptions({ bypassTenant: true });
  for (const personId of personIds) {
    await PersonHubBuilder.rebuildPerson(personId);
  }
  console.log(`rebuilt ${personIds.length} person hubs`);

  const staleHubs = await PersonHubView.find({ inArtistPath: true })
    .setOptions({ bypassTenant: true })
    .select('personId')
    .lean();
  for (const hub of staleHubs) {
    if (personIds.some((id) => String(id) === String(hub.personId))) continue;
    try {
      await PersonHubBuilder.rebuildPerson(hub.personId);
    } catch (err) {
      console.warn('stale hub rebuild skipped', hub.personId, err.message);
    }
  }

  const count = await PersonHubView.countDocuments({ inArtistPath: true }).setOptions({ bypassTenant: true });
  console.log(`inArtistPath hubs: ${count}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
