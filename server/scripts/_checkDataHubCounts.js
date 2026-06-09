require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? process.env.MONGODB_URI_PROD
    : (process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!uri) {
    console.error('No MONGO URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const BYPASS = { bypassTenant: true };
  const PersonIndex = require('../models/PersonIndex');
  const PersonHubView = require('../models/PersonHubView');
  const OutsourcedRecord = require('../models/OutsourcedRecord');
  const Lead = require('../models/Lead');
  const ExlyBooking = require('../models/ExlyBooking');

  const Person = require('../models/Person');
  const [idx, hub, hubInlets, out, leads, exly, people] = await Promise.all([
    PersonIndex.countDocuments({}).setOptions(BYPASS),
    PersonHubView.countDocuments({}).setOptions(BYPASS),
    PersonHubView.countDocuments({ inletCount: { $gte: 1 } }).setOptions(BYPASS),
    OutsourcedRecord.countDocuments({}),
    Lead.countDocuments({}),
    ExlyBooking.countDocuments({}),
    Person.countDocuments({}),
  ]);

  console.log(JSON.stringify({
    personIndex: idx,
    personHubView: hub,
    hubWithInlets: hubInlets,
    people,
    outsourcedRecords: out,
    leads,
    exlyBookings: exly,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
