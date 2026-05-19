const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const CRMAudit = mongoose.models.CRMAudit || mongoose.model('CRMAudit', new mongoose.Schema({}, { strict: false }));

    const aryaman = await User.findOne({ name: /aryaman/i });
    if (!aryaman) {
      console.log('Aryaman user not found!');
      await mongoose.disconnect();
      return;
    }
    console.log(`Aryaman ID: ${aryaman._id}`);

    const logs = await CRMAudit.find({ userId: aryaman._id });
    console.log(`Number of changes made by Aryaman: ${logs.length}`);
    const modifiedLeadIds = [...new Set(logs.map(l => l.leadId.toString()))];
    console.log(`Unique leads modified by Aryaman in audit logs: ${modifiedLeadIds.length}`);
    console.log('Lead IDs:', modifiedLeadIds);

    // Let's also check if any leads have Aryaman as the assignedRepId
    const Lead = mongoose.models.Lead || mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));
    const assignedLeads = await Lead.find({ assignedRepId: aryaman._id });
    console.log(`Leads currently assigned to Aryaman: ${assignedLeads.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error running check script:', error);
  }
}

run();
