/**
 * Backfill tenantId on ArtistPathResponse docs imported without tenant context.
 * Usage: node server/scripts/backfillArtistPathTenant.js
 *        node server/scripts/backfillArtistPathTenant.js --prod
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const Tenant = require('../models/Tenant');

const useProd = process.argv.includes('--prod');

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  let tenant = await Tenant.findOne({ name: 'Default Tenant' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'helloworld@theshakticollective',
    });
  }

  const res = await ArtistPathResponse.updateMany(
    { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
    { $set: { tenantId: tenant._id } }
  ).setOptions({ bypassTenant: true });

  console.log(`${useProd ? 'prod' : 'local'} (${mongoose.connection.db.databaseName}): updated ${res.modifiedCount} responses`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
