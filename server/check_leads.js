const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// We don't need 'papaparse' if we parse CSV simply or install it, let's just parse line by line
const MONGODB_URI = 'mongodb+srv://raghavsobti37_db_user:rpSmwUYLByGbgSKs@main-cluster.lgafikg.mongodb.net/?appName=main-cluster';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const LeadSchema = new mongoose.Schema({}, { strict: false });
    const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema, 'leads');

    const dbCount = await Lead.countDocuments({});
    console.log(`Leads in Database: ${dbCount}`);

    const backupDirs = ['2026-05-18T10_54_31', '2026-05-18T10_56_09', '2026-05-18T11_07_09', '2026-05-19T15_42_00'];
    const projectRoot = 'c:\\Users\\ragha\\OneDrive\\Desktop\\Taskmaster';

    for (const dir of backupDirs) {
      const csvPath = path.join(projectRoot, 'backups', dir, 'leads.csv');
      if (fs.existsSync(csvPath)) {
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        const lines = fileContent.trim().split('\n');
        console.log(`Backup ${dir} - Row count: ${lines.length - 1} (lines count)`);
      } else {
        console.log(`Backup ${dir} - leads.csv NOT found`);
      }
    }

    // Also check root leads.csv
    const rootCsvPath = path.join(projectRoot, 'leads.csv');
    if (fs.existsSync(rootCsvPath)) {
      const fileContent = fs.readFileSync(rootCsvPath, 'utf8');
      const lines = fileContent.trim().split('\n');
      console.log(`Root leads.csv - Row count: ${lines.length - 1}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error running check script:', error);
  }
}

run();
