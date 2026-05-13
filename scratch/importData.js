const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const Lead = require('../server/models/Lead');
const User = require('../server/models/User');

const CSV_PATH = path.join(__dirname, '../leads_db_import.csv');

async function importData() {
  try {
    const dbUri = process.env.MONGODB_URI;
    if (!dbUri) throw new Error('MONGODB_URI not found in .env');

    await mongoose.connect(dbUri);
    console.log('[SUCCESS] Connected to MongoDB');

    // Purge old leads
    console.log('[SYSTEM] Purging existing leads...');
    await Lead.deleteMany({});
    console.log('[SUCCESS] Database purged');

    // Get sales reps for distribution if needed
    const reps = await User.find({ role: 'sales' });
    const repMap = {};
    reps.forEach(r => {
      repMap[r.name.toLowerCase().trim()] = r._id;
      // Also map by rep ID if it exists (e.g. sr01)
      if (r.assignedRepId) repMap[r.assignedRepId.toLowerCase().trim()] = r._id;
    });

    const results = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`[SYSTEM] Processing ${results.length} records...`);
        const leadDocs = [];
        let repIndex = 0;

        for (const row of results) {
          // Identify assigned rep
          const rawRep = (row.assignedRepId || row.assigned_rep_id || row.rep || row.Rep || '').toLowerCase().trim();
          let assignedRepId = null;

          if (rawRep && repMap[rawRep]) {
            assignedRepId = repMap[rawRep];
          } else if (reps.length > 0) {
             // Fallback to least loaded or round robin for this script
             assignedRepId = reps[repIndex % reps.length]._id;
             repIndex++;
          }

          leadDocs.push({
            rowId: row.rowId || row.row_id,
            customerIdExly: row.customerIdExly,
            transactionIdExly: row.transactionIdExly,
            name: row.name || row.Name || 'Unknown',
            email: row.email || row.Email || '',
            phone: row.phone || row.Phone || '0000000000',
            webinarDates: row.webinarDates || row.webinar_dates,
            attended: row.attended || row.Attended,
            attendanceDurationMin: row.attendanceDurationMin || row.attendance_duration_min,
            qnaAnswered: row.qnaAnswered,
            artistType: row.artistType,
            fullTimeWillingness: row.fullTimeWillingness,
            primaryRole: row.primaryRole,
            learningGoal: row.learningGoal,
            learnedMusic: row.learnedMusic,
            currentJourney: row.currentJourney,
            meaningfulConnect: row.meaningfulConnect || row.meaningful_connect || 'NO',
            leadQuality: row.leadQuality || row.lead_quality || '1',
            callStatus: row.callStatus || row.call_status || 'Pending',
            leadStatus: row.leadStatus || row.lead_status || 'New',
            remarks: row.remarks || row.notes || row.Remarks || '',
            nextFollowupDate: row.nextFollowupDate || row.next_followup_date || '',
            assignedRepId: assignedRepId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        console.log(`[SYSTEM] Inserting ${leadDocs.length} leads...`);
        // Batch insert in chunks to avoid memory issues
        const chunkSize = 500;
        for (let i = 0; i < leadDocs.length; i += chunkSize) {
          const chunk = leadDocs.slice(i, i + chunkSize);
          await Lead.insertMany(chunk);
          console.log(`[PROGRESS] Inserted ${Math.min(i + chunkSize, leadDocs.length)}/${leadDocs.length}`);
        }

        console.log('[SUCCESS] Import completed');
        process.exit(0);
      });

  } catch (error) {
    console.error('[ERROR] Import failed:', error.message);
    process.exit(1);
  }
}

importData();
