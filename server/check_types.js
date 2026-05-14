const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster';

async function check() {
  await mongoose.connect(MONGO_URI);
  const Lead = mongoose.model('Lead', new mongoose.Schema({ assignedRepId: mongoose.Schema.Types.Mixed }));
  
  const allLeads = await Lead.find({}).limit(100);
  console.log('Sample IDs types:');
  allLeads.forEach(l => {
    if (l.assignedRepId) {
      console.log(typeof l.assignedRepId, l.assignedRepId.constructor.name, l.assignedRepId);
    }
  });

  const stringReps = await Lead.find({ assignedRepId: { $type: 'string' } });
  console.log('String Rep IDs total:', stringReps.length);
  if (stringReps.length > 0) {
    console.log('Example string rep:', stringReps[0].assignedRepId);
  }

  process.exit();
}

check();
