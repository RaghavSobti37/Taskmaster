const mongoose = require('mongoose');

const MONGO_URI = "mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster";

async function purge() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB for purge...");
    
    // Check if models exist, if not define them
    const Lead = mongoose.models.Lead || mongoose.model('Lead', new mongoose.Schema({}, { strict: false }));
    const EMI = mongoose.models.EMI || mongoose.model('EMI', new mongoose.Schema({}, { strict: false }));
    const CRMImport = mongoose.models.CRMImport || mongoose.model('CRMImport', new mongoose.Schema({}, { strict: false }));
    const CRMAudit = mongoose.models.CRMAudit || mongoose.model('CRMAudit', new mongoose.Schema({}, { strict: false }));

    await Lead.deleteMany({});
    await EMI.deleteMany({});
    await CRMImport.deleteMany({});
    await CRMAudit.deleteMany({});

    console.log("CRM DATA PURGED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Purge failed:", err);
    process.exit(1);
  }
}

purge();
