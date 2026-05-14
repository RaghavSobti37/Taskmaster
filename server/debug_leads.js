const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster';

async function debug() {
  await mongoose.connect(MONGO_URI);
  const Lead = mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));
  
  const sample = await Lead.findOne({ remarks: /vicky/i });
  console.log('Remarks match:', JSON.stringify(sample));
  
  const sample2 = await Lead.findOne({ metadata: /vicky/i });
  console.log('Metadata match:', JSON.stringify(sample2));

  const all = await Lead.findOne({ $or: [{ remarks: { $exists: true } }] });
  console.log('Sample Lead Keys:', Object.keys(all._doc));

  process.exit();
}

debug();
