const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Lead = require('../models/Lead');
const User = require('../models/User');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');

const CSV_PATH = path.join(__dirname, '../../leads.csv');
const MONGO_URI = process.env.MONGODB_URI;

const repMapping = {
  'sr01': 'Rohit Sobti',
  'sr02': 'Deepank Soni',
  'sr03': 'Rinki Roy',
  'sr04': 'Raghav Sobti',
  'sr05': 'Sonesh Jain',
  'sr06': 'Satyam Mishra',
  'sr07': 'Shivam Sahijwani',
  'sr08': 'Harshika Kasliwal',
  'sr09': 'Aryaman'
};

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Purge Lead collection completely
    console.log('Purging Lead collection...');
    await Lead.deleteMany({});
    console.log('Lead collection purged.');

    // Fetch users for mapping
    const reps = await User.find({ role: 'sales' });
    const userMap = {};
    reps.forEach(r => {
      userMap[r.name.toLowerCase().trim()] = r._id;
    });

    // Also support fallback using repMapping names
    const repIds = {};
    for (const [srId, name] of Object.entries(repMapping)) {
      let user = reps.find(r => r.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (!user) {
        user = await User.create({
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@tscacademy.in`,
          role: 'sales',
          phone: ''
        });
        console.log(`Created rep: ${name}`);
      }
      repIds[srId] = user._id;
    }

    const rows = [];
    await new Promise((resolve) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve);
    });

    console.log(`Parsed ${rows.length} raw rows from leads.csv`);

    const finalLeads = [];
    const seenPhones = new Set();
    const seenEmails = new Set();

    let skippedEmpty = 0;
    let skippedDupPhone = 0;
    let skippedDupEmail = 0;

    for (const row of rows) {
      const name = sanitizeName(row.name || row.Name || 'Unknown');
      const email = sanitizeEmail(row.email || row.Email || '');
      const phone = normalizePhone(row.phone || row.Phone || row['Mobile Number'] || '');

      if (!phone && !email) {
        skippedEmpty++;
        continue;
      }

      // Check unique constraints
      if (phone && seenPhones.has(phone)) {
        skippedDupPhone++;
        continue;
      }
      if (email && seenEmails.has(email)) {
        skippedDupEmail++;
        continue;
      }

      // Mark seen
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);

      // Determine rep ID
      const rawRep = (row.assignedRepId || row.assigned_rep_id || row.Rep || row.rep || '').toLowerCase().trim();
      let assignedRepId = null;
      if (repIds[rawRep]) {
        assignedRepId = repIds[rawRep];
      } else if (userMap[rawRep]) {
        assignedRepId = userMap[rawRep];
      } else if (reps.length > 0) {
        assignedRepId = reps[0]._id;
      }

      const leadDoc = {
        name,
        email,
        phone: phone || '0000000000',
        webinarDates: row.webinarDates || '',
        attended: row.attended || '',
        attendanceDurationMin: row.attendanceDurationMin || '',
        qnaAnswered: row.qnaAnswered || '',
        artistType: row.artistType || '',
        fullTimeWillingness: row.fullTimeWillingness || '',
        primaryRole: row.primaryRole || '',
        learningGoal: row.learningGoal || '',
        learnedMusic: row.learnedMusic || '',
        currentJourney: row.currentJourney || '',
        meaningfulConnect: row.meaningfulConnect || 'PENDING',
        leadQuality: row.leadQuality || '1',
        callStatus: row.callStatus || 'Pending',
        leadStatus: row.leadStatus || 'New',
        remarks: row.remarks || '',
        source: row.webinarDates ? `Webinar - ${row.webinarDates}` : 'Organic / Direct',
        planOption: row.planOption || '',
        nextFollowupDate: row.nextFollowupDate || '',
        nextFollowupTime: row.nextFollowupTime || '',
        assignedRepId,
        metadata: {
          artistType: row.artistType,
          fullTimeWillingness: row.fullTimeWillingness,
          primaryRole: row.primaryRole,
          learningGoal: row.learningGoal,
          learnedMusic: row.learnedMusic,
          currentJourney: row.currentJourney
        }
      };

      if (row.rowId && row.rowId.trim() !== '') {
        leadDoc.rowId = row.rowId.trim();
      }

      finalLeads.push(leadDoc);
    }

    console.log(`Deduplication results:
    - Skipped empty phone/email: ${skippedEmpty}
    - Skipped duplicate phones: ${skippedDupPhone}
    - Skipped duplicate emails: ${skippedDupEmail}
    - Final unique leads to insert: ${finalLeads.length}`);

    await Lead.insertMany(finalLeads);
    console.log('Successfully inserted clean leads.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to reset leads:', err.message);
    if (err.errors) {
      console.error('Validation errors:', Object.keys(err.errors).map(k => `${k}: ${err.errors[k].message}`));
    }
    process.exit(1);
  }
}

run();
