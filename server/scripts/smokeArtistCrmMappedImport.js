/**
 * Production smoke: mapped artist CSV import (dry path via local file).
 * Usage: node server/scripts/smokeArtistCrmMappedImport.js --prod
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const { importArtistCsvWithOptions } = require('../domains/crm/services/artistCrmMappedImportService');
const { listArtistCallAssignees } = require('../utils/artistCallAssignees');

const SAMPLE_CSV = path.join(
  __dirname,
  '../data/crm-sheet-import/1ZOHoK4hPBGJXrdEvwSv7vgwBO_I7UbmPKceHOBLKP4A/Awards & Summits.csv',
);

async function main() {
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  const admin = await User.findOne().setOptions({ bypassTenant: true }).sort({ createdAt: 1 });
  const assignees = await listArtistCallAssignees();
  const rohith = assignees.find((u) => /rohith/i.test(u.name || ''));
  const assigneeId = rohith?._id || assignees[0]?._id;
  if (!assigneeId) throw new Error('No artist assignees found');

  const mapping = {
    name: 'Event Name',
    email: 'Contact Information',
    phone: 'Contact Information',
    city: 'Location',
  };

  const result = await importArtistCsvWithOptions({
    filePath: SAMPLE_CSV,
    filename: 'smoke-awards-mapped.csv',
    userId: admin._id,
    mapping,
    assignedRepId: assigneeId,
  });

  console.log(JSON.stringify({ assignee: rohith?.name || assignees[0]?.name, ...result }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
