require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Lead = require('../models/Lead');
const TscData = require('../models/TscData');
const { sanitizeLocation } = require('../utils/sanitizer');
const { backupAllLeadsToCsv } = require('../services/csvBackupService');
const { backupAllLeads } = require('../services/holySheetService');

const ROOT_DIR = path.join(__dirname, '../../');
const BACKUPS_ROOT = path.join(ROOT_DIR, 'backups');

async function runProcessAndSync() {
  try {
    console.log('==================================================');
    console.log('🚀 STARTING ALL-TIME DATA SANITIZATION & SYNC PIPELINE');
    console.log('==================================================');

    // 1. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster');
    console.log('[SUCCESS] Connected to MongoDB.');

    // 2. Organize Old Files into Timed Backup Folder
    if (!fs.existsSync(BACKUPS_ROOT)) {
      fs.mkdirSync(BACKUPS_ROOT, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_').substring(0, 19);
    const currentBackupDir = path.join(BACKUPS_ROOT, timestamp);
    fs.mkdirSync(currentBackupDir, { recursive: true });
    console.log(`[INFO] Created organized archive directory: backups/${timestamp}`);

    const filesToArchive = ['leads.csv', 'ULTIMATE_MASTER_DATA_CLEANED.csv', 'leads_export.csv'];
    for (const file of filesToArchive) {
      const sourcePath = path.join(ROOT_DIR, file);
      if (fs.existsSync(sourcePath)) {
        const destPath = path.join(currentBackupDir, file);
        fs.copyFileSync(sourcePath, destPath);
        console.log(`[ARCHIVE] Copied ${file} to backups/${timestamp}/${file}`);
      }
    }

    // 3. Load all leads and TscData
    console.log('[INFO] Fetching all Lead and TscData records from database...');
    const allLeads = await Lead.find({});
    const allTsc = await TscData.find({});
    console.log(`[INFO] Loaded ${allLeads.length} CRM Leads and ${allTsc.length} TscData Master records.`);

    // 4. Create lookup maps by email and phone for lightning fast bidirectional sync
    const leadByEmail = new Map();
    const leadByPhone = new Map();
    for (const l of allLeads) {
      if (l.email) leadByEmail.set(l.email.toLowerCase(), l);
      if (l.phone && l.phone !== '0000000000') leadByPhone.set(l.phone, l);
    }

    const tscByEmail = new Map();
    const tscByPhone = new Map();
    for (const t of allTsc) {
      if (t.email) tscByEmail.set(t.email.toLowerCase(), t);
      if (t.phone) tscByPhone.set(t.phone, t);
    }

    let leadUpdates = 0;
    let tscUpdates = 0;

    // 5. Bidirectional City/Location Sync & Strict Lowercase / Special Char Stripping
    console.log('[INFO] Normalizing locations (strictly lowercase, stripping (),.) and cross-hydrating missing cities...');

    const leadBulkOps = [];
    for (const l of allLeads) {
      let isModified = false;
      const oldCity = l.city || '';
      let cleanCity = sanitizeLocation(oldCity);

      // If missing city, try to grab from TscData match
      if (!cleanCity) {
        const matchedTsc = (l.email && tscByEmail.get(l.email.toLowerCase())) || (l.phone && tscByPhone.get(l.phone));
        if (matchedTsc && matchedTsc.city) {
          cleanCity = sanitizeLocation(matchedTsc.city);
        }
      }

      if (cleanCity !== oldCity) {
        leadBulkOps.push({
          updateOne: {
            filter: { _id: l._id },
            update: { $set: { city: cleanCity } }
          }
        });
        leadUpdates++;
      }
    }

    const tscBulkOps = [];
    for (const t of allTsc) {
      let isModified = false;
      const oldCity = t.city || '';
      let cleanCity = sanitizeLocation(oldCity);

      // If missing city, try to grab from Lead match
      if (!cleanCity) {
        const matchedLead = (t.email && leadByEmail.get(t.email.toLowerCase())) || (t.phone && leadByPhone.get(t.phone));
        if (matchedLead && matchedLead.city) {
          cleanCity = sanitizeLocation(matchedLead.city);
        }
      }

      const oldState = t.state || '';
      const cleanState = sanitizeLocation(oldState);

      const updateSet = {};
      if (cleanCity !== oldCity) updateSet.city = cleanCity;
      if (cleanState !== oldState) updateSet.state = cleanState;

      if (Object.keys(updateSet).length > 0) {
        tscBulkOps.push({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: updateSet }
          }
        });
        tscUpdates++;
      }
    }

    // 6. Execute bulk writes
    if (leadBulkOps.length > 0) {
      console.log(`[INFO] Executing ${leadBulkOps.length} Lead bulk updates...`);
      await Lead.bulkWrite(leadBulkOps, { ordered: false });
    }
    if (tscBulkOps.length > 0) {
      console.log(`[INFO] Executing ${tscBulkOps.length} TscData bulk updates...`);
      await TscData.bulkWrite(tscBulkOps, { ordered: false });
    }
    console.log(`[SUCCESS] Database normalization complete. Updated ${leadUpdates} Leads and ${tscUpdates} TscData records.`);

    // 7. Trigger CSV Backup
    console.log('[INFO] Regenerating pristine leads.csv with standardized 30-column layout...');
    backupAllLeadsToCsv();

    // 8. Trigger HolySheet Batch Sync
    console.log('[INFO] Initiating full batch synchronization with HolySheet Google Sheet (All Data Backup)...');
    await backupAllLeads();

    console.log('[INFO] Waiting for background disk I/O buffers to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n==================================================');
    console.log('✅ ALL-TIME DATA PIPELINE COMPLETE!');
    console.log('==================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Pipeline failed:', error);
    process.exit(1);
  }
}

runProcessAndSync();
