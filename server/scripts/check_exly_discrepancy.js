const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CRMAudit = require('../models/CRMAudit');

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);

  console.log('--- LATEST CRM AUDIT LOGS ---');
  const audits = await CRMAudit.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log(audits);

  await mongoose.disconnect();
}

run().catch(console.error);
