require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const TscData = require('../models/TscData');
const { sanitizeLocation } = require('../utils/sanitizer');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster';

async function runMigration() {
  try {
    console.log('[START] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[SUCCESS] Connected to MongoDB.');

    console.log('[INFO] Cleaning Lead locations and cities via raw collection updates...');
    const leadsCol = Lead.collection;
    const leads = await leadsCol.find({ $or: [{ city: { $exists: true, $ne: null } }, { location: { $exists: true, $ne: null } }] }).toArray();
    let leadsUpdated = 0;
    
    for (const l of leads) {
      const updateDoc = {};
      if (l.city) {
        const clean = sanitizeLocation(l.city);
        if (clean !== l.city) updateDoc.city = clean;
      }
      if (l.location) {
        const clean = sanitizeLocation(l.location);
        if (clean !== l.location) updateDoc.location = clean;
      }
      if (Object.keys(updateDoc).length > 0) {
        await leadsCol.updateOne({ _id: l._id }, { $set: updateDoc });
        leadsUpdated++;
      }
    }
    console.log(`[SUCCESS] Updated ${leadsUpdated} Lead records.`);

    console.log('[INFO] Cleaning TscData cities and states via raw collection updates...');
    const tscCol = TscData.collection;
    const tscs = await tscCol.find({ $or: [{ city: { $exists: true, $ne: null } }, { state: { $exists: true, $ne: null } }] }).toArray();
    let tscUpdated = 0;
    
    for (const t of tscs) {
      const updateDoc = {};
      if (t.city) {
        const clean = sanitizeLocation(t.city);
        if (clean !== t.city) updateDoc.city = clean;
      }
      if (t.state) {
        const clean = sanitizeLocation(t.state);
        if (clean !== t.state) updateDoc.state = clean;
      }
      if (Object.keys(updateDoc).length > 0) {
        await tscCol.updateOne({ _id: t._id }, { $set: updateDoc });
        tscUpdated++;
      }
    }
    console.log(`[SUCCESS] Updated ${tscUpdated} TscData records.`);

    console.log('\n========================================');
    console.log('[MIGRATION COMPLETE]');
    console.log('========================================\n');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
