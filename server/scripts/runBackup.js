const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const holySheetService = require('../services/holySheetService');
const csvBackupService = require('../services/csvBackupService');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('Connected to MongoDB. Starting manual backup...');
  
  console.log('Backing up to HolySheet...');
  await holySheetService.backupAllLeads();
  
  console.log('Backing up to leads.csv...');
  csvBackupService.backupAllLeadsToCsv();
  
  // Wait a few seconds for the debounce timeout in csvBackupService
  setTimeout(() => {
    console.log('Backup complete.');
    process.exit(0);
  }, 2000);
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
