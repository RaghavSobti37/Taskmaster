require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const TscData = require('../models/TscData');
const { sanitizeName, sanitizeEmail, normalizePhone } = require('../utils/sanitizer');

const CSV_PATH = path.join(__dirname, '../../ULTIMATE_MASTER_DATA_CLEANED.csv');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster';

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = sanitizeEmail(email);
  return clean.includes('@') && clean.includes('.') && clean.length > 5;
}

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const clean = normalizePhone(phone);
  return clean.length >= 10;
}

async function importUltimateMaster() {
  try {
    console.log('[START] Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('[SUCCESS] Connected to MongoDB.');

    if (!fs.existsSync(CSV_PATH)) {
      console.error(`[ERROR] File not found at: ${CSV_PATH}`);
      process.exit(1);
    }

    console.log('[INFO] Fetching existing TscData records from DB for perfect deduplication...');
    const allExisting = await TscData.find({}, '_id email phone').lean();
    
    const dbByEmail = new Map();
    const dbByPhone = new Map();
    const compoundSet = new Set(); // To track exact phone|email combinations

    for (const doc of allExisting) {
      if (doc.email) dbByEmail.set(doc.email, doc._id);
      if (doc.phone) dbByPhone.set(doc.phone, doc._id);
      if (doc.email && doc.phone) compoundSet.add(`${doc.phone}|${doc.email}`);
    }
    console.log(`[SUCCESS] Loaded ${allExisting.length} existing records into in-memory deduplication index.`);

    console.log('[INFO] Parsing and cleaning CSV...');
    const updateOps = [];
    const insertOps = [];
    let totalRows = 0;
    let skippedRows = 0;

    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        totalRows++;
        const name = sanitizeName(row.Name || row.name || 'Unknown');
        const email = sanitizeEmail(row.Email || row.email);
        const phone = normalizePhone(row.Phone || row.phone);

        if (!isValidEmail(email) && !isValidPhone(phone)) {
          skippedRows++;
          return;
        }

        const compKey = `${phone}|${email}`;
        if (compoundSet.has(compKey)) {
          // Exactly matching phone & email combination already exists
          // Find the ID to update non-key fields
          const id = dbByEmail.get(email) || dbByPhone.get(phone);
          if (id) {
            updateOps.push({
              updateOne: {
                filter: { _id: id },
                update: {
                  $set: {
                    city: row.City || '',
                    state: row.State || '',
                    role: row.Role || '',
                    mediaUrl: row.Media_URL || '',
                    timestamp: row.Timestamp || '',
                    originSource: row.Origin_Source || '',
                    destination: row.Destination || '',
                    campaign: row.Campaign || '',
                    dataType: row.Data_Type || '',
                    dateCreatedFile: row.Date_Created_File || '',
                    dateModifiedFile: row.Date_Modified_File || '',
                    sourceFilename: row.Source_Filename || 'ULTIMATE_MASTER_DATA_CLEANED.csv'
                  },
                  $addToSet: { tags: row.Campaign ? row.Campaign.trim() : 'CSV_Import' }
                }
              }
            });
          } else {
            skippedRows++;
          }
          return;
        }

        // Check if either email or phone already exists separately
        let existingId = null;
        if (email && dbByEmail.has(email)) {
          existingId = dbByEmail.get(email);
        } else if (phone && dbByPhone.has(phone)) {
          existingId = dbByPhone.get(phone);
        }

        if (existingId) {
          // Update the existing document without altering its existing email/phone to prevent index collisions
          updateOps.push({
            updateOne: {
              filter: { _id: existingId },
              update: {
                $set: {
                  city: row.City || '',
                  state: row.State || '',
                  role: row.Role || '',
                  mediaUrl: row.Media_URL || '',
                  timestamp: row.Timestamp || '',
                  originSource: row.Origin_Source || '',
                  destination: row.Destination || '',
                  campaign: row.Campaign || '',
                  dataType: row.Data_Type || '',
                  dateCreatedFile: row.Date_Created_File || '',
                  dateModifiedFile: row.Date_Modified_File || '',
                  sourceFilename: row.Source_Filename || 'ULTIMATE_MASTER_DATA_CLEANED.csv'
                },
                $addToSet: { tags: row.Campaign ? row.Campaign.trim() : 'CSV_Import' }
              }
            }
          });
          // Also track this compound key
          if (email && phone) compoundSet.add(compKey);
        } else {
          // Completely new record
          const newId = new mongoose.Types.ObjectId();
          const newDoc = {
            _id: newId,
            name,
            email,
            phone,
            city: row.City || '',
            state: row.State || '',
            role: row.Role || '',
            mediaUrl: row.Media_URL || '',
            timestamp: row.Timestamp || '',
            originSource: row.Origin_Source || '',
            destination: row.Destination || '',
            campaign: row.Campaign || '',
            dataType: row.Data_Type || '',
            dateCreatedFile: row.Date_Created_File || '',
            dateModifiedFile: row.Date_Modified_File || '',
            sourceFilename: row.Source_Filename || 'ULTIMATE_MASTER_DATA_CLEANED.csv',
            tags: [row.Campaign ? row.Campaign.trim() : 'CSV_Import'],
            emailStatus: 'Active'
          };

          if (email) dbByEmail.set(email, newId);
          if (phone) dbByPhone.set(phone, newId);
          if (email && phone) compoundSet.add(compKey);

          insertOps.push({ insertOne: { document: newDoc } });
        }
      })
      .on('end', async () => {
        console.log(`[INFO] CSV Parsing complete. Total rows: ${totalRows}, Updates queued: ${updateOps.length}, Inserts queued: ${insertOps.length}, Skipped invalid: ${skippedRows}`);
        console.log('[INFO] Executing database batch writes...');

        const allOps = [...insertOps, ...updateOps];
        const chunkSize = 1000;
        let insertedCount = 0;
        let modifiedCount = 0;

        for (let i = 0; i < allOps.length; i += chunkSize) {
          const chunk = allOps.slice(i, i + chunkSize);
          const res = await TscData.bulkWrite(chunk, { ordered: false });
          insertedCount += res.insertedCount || 0;
          modifiedCount += res.modifiedCount || res.upsertedCount || 0;

          const progress = Math.min(i + chunkSize, allOps.length);
          const percent = ((progress / allOps.length) * 100).toFixed(1);
          console.log(`[PROGRESS] Processed ${progress}/${allOps.length} (${percent}%) | Inserted: ${insertedCount}, Updated: ${modifiedCount}`);
        }

        const finalDBCount = await TscData.countDocuments();
        console.log('\n==================================================');
        console.log('[SUCCESS] All Data Tab (TscData) Import Complete!');
        console.log(`- Final Total Records in DB: ${finalDBCount}`);
        console.log(`- New Records Inserted: ${insertedCount}`);
        console.log(`- Existing Records Updated: ${modifiedCount}`);
        console.log('==================================================\n');
        process.exit(0);
      });
  } catch (error) {
    console.error('[ERROR] Import failed:', error);
    process.exit(1);
  }
}

importUltimateMaster();
