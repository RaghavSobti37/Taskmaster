const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Models
const User = require('../models/User');
const Lead = require('../models/Lead');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster';

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

const importLeads = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Ensure Rep Users exist
    const userMap = {};
    for (const [id, name] of Object.entries(repMapping)) {
      let user = await User.findOne({ name: name });
      if (!user) {
        user = await User.create({
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@tscacademy.in`,
          role: 'sales',
          phone: ''
        });
        console.log(`Created user: ${name}`);
      }
      userMap[id] = user._id;
    }

    // 2. Parse CSV
    const leads = [];
    const csvPath = path.join(__dirname, '../../leads_db_import.csv');

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Clean up data
        const lead = {
          rowId: row.rowId,
          customerIdExly: row.customerIdExly,
          transactionIdExly: row.transactionIdExly,
          name: row.name,
          email: row.email,
          phone: row.phone,
          webinarDates: row.webinarDates,
          attended: row.attended,
          attendanceDurationMin: row.attendanceDurationMin,
          qnaAnswered: row.qnaAnswered,
          artistType: row.artistType,
          fullTimeWillingness: row.fullTimeWillingness,
          primaryRole: row.primaryRole,
          learningGoal: row.learningGoal,
          learnedMusic: row.learnedMusic,
          currentJourney: row.currentJourney,
          meaningfulConnect: row.meaningfulConnect,
          leadQuality: row.leadQuality,
          callStatus: row.callStatus,
          leadStatus: row.leadStatus,
          remarks: row.remarks,
          source: row.webinarDates ? `Webinar - ${row.webinarDates}` : 'Organic / Direct',
          planOption: row.planOption,
          nextFollowupDate: row.nextFollowupDate,
          nextFollowupTime: row.nextFollowupTime,
          assignedRepId: userMap[row.assignedRepId] || null,
          metadata: {
            artistType: row.artistType,
            fullTimeWillingness: row.fullTimeWillingness,
            primaryRole: row.primaryRole,
            learningGoal: row.learningGoal,
            learnedMusic: row.learnedMusic,
            currentJourney: row.currentJourney
          }
        };
        leads.push(lead);
      })
      .on('end', async () => {
        console.log(`Parsed ${leads.length} leads. Starting import...`);

        // Use bulkWrite for efficiency and to handle existing rowIds
        const operations = leads.map(lead => {
          const filter = { $or: [] };
          if (lead.rowId) filter.$or.push({ rowId: lead.rowId });
          if (lead.phone) filter.$or.push({ phone: lead.phone });
          if (lead.email) filter.$or.push({ email: lead.email.toLowerCase() });

          return {
            updateOne: {
              filter: filter.$or.length > 0 ? filter : { _id: new mongoose.Types.ObjectId() },
              update: { $set: lead },
              upsert: true
            }
          };
        });

        const result = await Lead.bulkWrite(operations);
        console.log('Import completed:');
        console.log(`- Matched: ${result.matchedCount}`);
        console.log(`- Upserted: ${result.upsertedCount}`);
        console.log(`- Modified: ${result.modifiedCount}`);

        process.exit(0);
      });

  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
};

importLeads();
