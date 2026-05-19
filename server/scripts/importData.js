const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Lead = require('../models/Lead');
const User = require('../models/User');

const CSV_PATH = path.join(__dirname, '../../leads.csv');

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

    // Get sales reps for distribution
    const reps = await User.find({ role: 'sales' });
    const repMap = {};
    reps.forEach(r => {
      repMap[r.name.toLowerCase().trim()] = r._id;
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
          // Row headers might be different, let's normalize
          const name = row.name || row.Name || row['Full Name'] || 'Unknown';
          const email = row.email || row.Email || '';
          const phone = row.phone || row.Phone || row['Mobile Number'] || '0000000000';
          
          const rawRep = (row.assignedRepId || row.assigned_rep_id || row.Rep || row.rep || '').toLowerCase().trim();
          let assignedRepId = null;

          if (rawRep && repMap[rawRep]) {
            assignedRepId = repMap[rawRep];
          } else if (reps.length > 0) {
             assignedRepId = reps[repIndex % reps.length]._id;
             repIndex++;
          }

          leadDocs.push({
            name,
            email,
            phone,
            assignedRepId,
            leadStatus: row.leadStatus || row.lead_status || 'New',
            callStatus: row.callStatus || row.call_status || 'Pending',
            leadQuality: row.leadQuality || row.lead_quality || '1',
            webinarDates: row.webinarDates || row.webinar_dates || '',
            attended: row.attended || row.Attended || '',
            remarks: row.remarks || row.notes || row.Remarks || '',
            rowId: row.rowId || row.row_id || '',
            customerIdExly: row.customerIdExly || '',
            transactionIdExly: row.transactionIdExly || '',
            nextFollowupDate: row.nextFollowupDate || row.next_followup_date || ''
          });
        }

        console.log(`[SYSTEM] Inserting ${leadDocs.length} leads...`);
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
