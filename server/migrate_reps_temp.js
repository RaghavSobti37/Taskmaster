const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster';

async function migrate() {
  await mongoose.connect(MONGO_URI);
  const Lead = mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));
  
  const vickyId = new mongoose.Types.ObjectId('6a03ea289b737bf7387dc146');
  const aryamanId = new mongoose.Types.ObjectId('6a03ea289b737bf7387dc149');

  console.log('Fetching all leads...');
  const leads = await Lead.find({});
  
  let vCount = 0, aCount = 0, sCount = 0;

  for (const lead of leads) {
    const leadData = lead.toObject();
    const allText = JSON.stringify(leadData).toLowerCase();

    if (allText.includes('vicky')) {
      if (lead.assignedRepId?.toString() !== vickyId.toString()) {
        lead.assignedRepId = vickyId;
        vCount++;
        await lead.save();
      }
    } else if (allText.includes('aryaman')) {
      if (lead.assignedRepId?.toString() !== aryamanId.toString()) {
        lead.assignedRepId = aryamanId;
        aCount++;
        await lead.save();
      }
    } else if (allText.includes('shivam')) {
      if (lead.assignedRepId !== null) {
        lead.assignedRepId = null;
        sCount++;
        await lead.save();
      }
    }
  }

  console.log(`Vicky linked: ${vCount}`);
  console.log(`Aryaman linked: ${aCount}`);
  console.log(`Shivam unassigned: ${sCount}`);

  process.exit();
}

migrate();
