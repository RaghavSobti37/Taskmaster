const fs = require('fs');
const path = require('path');
const { parseAsync } = require('json2csv');

const CSV_PATH = path.join(__dirname, '../../leads.csv');

let isBackingUp = false;
let needsBackup = false;

// Debounced backup function to prevent disk IO spam on bulk updates
const triggerCsvBackup = () => {
  if (isBackingUp) {
    needsBackup = true;
    return;
  }
  
  isBackingUp = true;
  
  // Use setTimeout to allow current stack to finish
  setTimeout(async () => {
    try {
      const Lead = require('../models/Lead');
      const leads = await Lead.find({}).lean();
      
      const fields = [
        'rowId', 'customerIdExly', 'transactionIdExly', 'name', 'email', 'phone', 'city',
        'webinarDates', 'attended', 'attendanceDurationMin', 'qnaAnswered', 
        'artistType', 'fullTimeWillingness', 'primaryRole', 'learningGoal', 
        'learnedMusic', 'currentJourney', 'meaningfulConnect', 'leadQuality', 
        'callStatus', 'leadStatus', 'remarks', 'source', 'planOption', 
        'nextFollowupDate', 'nextFollowupTime', 'assignedRepId', '_id', 
        'createdAt', 'updatedAt'
      ];

      const csvData = await parseAsync(leads, { fields });
      fs.writeFileSync(CSV_PATH, csvData, 'utf8');
      console.log(`[CSV Backup] Successfully backed up ${leads.length} leads to leads.csv.`);
    } catch (error) {
      console.error(`[CSV Backup Error] ${error.message}`);
    } finally {
      isBackingUp = false;
      if (needsBackup) {
        needsBackup = false;
        triggerCsvBackup();
      }
    }
  }, 1000); // 1s debounce
};

exports.backupAllLeadsToCsv = triggerCsvBackup;
