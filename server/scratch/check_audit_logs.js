const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUri = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(dbUri);
  const CRMAudit = mongoose.model('CRMAudit', new mongoose.Schema({}, { strict: false }));

  const logs = await CRMAudit.find({ userId: { $ne: 'SYSTEM' } }).sort('-timestamp').limit(5).lean();
  console.log('USER AUDIT LOGS:');
  console.log(JSON.stringify(logs, null, 2));
  process.exit(0);
}

run();
