const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const Lead = require('./models/Lead');

    const lead = await Lead.findOne({});
    if (!lead) {
      console.log('No lead found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found lead: ${lead.name} (${lead._id}), remarks: ${lead.remarks}`);
    const testRemarks = 'Test remarks ' + Date.now();
    console.log(`Updating remarks to: "${testRemarks}"`);

    const updated = await Lead.findByIdAndUpdate(lead._id, { remarks: testRemarks }, { new: true });
    console.log(`Updated lead returned: ${updated.name}, remarks: ${updated.remarks}`);

    const verify = await Lead.findById(lead._id);
    console.log(`Verify from DB: ${verify.name}, remarks: ${verify.remarks}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error in test:', error);
  }
}

run();
