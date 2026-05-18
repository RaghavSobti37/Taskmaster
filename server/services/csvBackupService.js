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
        { label: 'row_id', value: 'rowId' },
        { label: 'customer_id_exly', value: 'customerIdExly' },
        { label: 'transaction_id_exly', value: 'transactionIdExly' },
        { label: 'assigned_rep_id', value: 'assignedRepId' },
        { label: 'name', value: 'name' },
        { label: 'email', value: 'email' },
        { label: 'phone', value: 'phone' },
        { label: 'city', value: 'city' },
        { label: 'webinar_dates', value: 'webinarDates' },
        { label: 'attended', value: 'attended' },
        { label: 'attendance_duration_min', value: 'attendanceDurationMin' },
        { label: 'qna_answered', value: 'qnaAnswered' },
        { label: 'artist_type', value: 'artistType' },
        { label: 'full_time_willingness', value: 'fullTimeWillingness' },
        { label: 'primary_role', value: 'primaryRole' },
        { label: 'learning_goal', value: 'learningGoal' },
        { label: 'learned_music', value: 'learnedMusic' },
        { label: 'current_journey', value: 'currentJourney' },
        { label: 'meaningful_connect', value: 'meaningfulConnect' },
        { label: 'lead_quality', value: 'leadQuality' },
        { label: 'call_status', value: 'callStatus' },
        { label: 'lead_status', value: 'leadStatus' },
        { label: 'remarks', value: 'remarks' },
        { label: 'next_followup_date', value: 'nextFollowupDate' },
        { label: 'next_followup_time', value: 'nextFollowupTime' },
        { label: 'plan_option', value: 'planOption' },
        { label: 'locked_by', value: 'lockedBy' },
        { label: 'locked_at', value: 'lockedAt' },
        { label: 'created_at', value: 'createdAt' },
        { label: 'updated_at', value: 'updatedAt' }
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
