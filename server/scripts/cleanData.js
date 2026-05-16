require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const TscData = require('../models/TscData');
const Task = require('../models/Task');
const { sanitizeName, sanitizeEmail, normalizePhone } = require('../utils/sanitizer');

const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot').trim();

async function cleanData() {
  try {
    console.log('[START] Historical Data Cleaning Script');
    await mongoose.connect(dbUri);
    console.log('[SUCCESS] Connected to MongoDB');

    // 1. Clean Users
    console.log('[PROCESS] Cleaning User collection...');
    const users = await User.find({});
    for (const user of users) {
      user.name = sanitizeName(user.name);
      user.email = sanitizeEmail(user.email);
      user.phone = normalizePhone(user.phone);
      await user.save();
    }
    console.log(`[DONE] Cleaned ${users.length} users.`);

    // 2. Clean Leads and Remove Duplicates
    console.log('[PROCESS] Cleaning Lead collection and removing duplicates...');
    const leads = await Lead.find({}).sort({ createdAt: 1 });
    const seen = new Set();
    let duplicatesRemoved = 0;

    for (const lead of leads) {
      // Normalize
      lead.name = sanitizeName(lead.name);
      lead.email = sanitizeEmail(lead.email);
      lead.phone = normalizePhone(lead.phone);

      const identity = `${lead.phone}|${lead.email}`;
      if (seen.has(identity)) {
        await Lead.deleteOne({ _id: lead._id });
        duplicatesRemoved++;
        continue;
      }
      seen.add(identity);
      await lead.save();
    }
    console.log(`[DONE] Cleaned Leads. Removed ${duplicatesRemoved} duplicates.`);

    // 3. Clean TscData
    console.log('[PROCESS] Cleaning TscData collection...');
    const tscData = await TscData.find({});
    for (const item of tscData) {
      item.name = sanitizeName(item.name);
      item.email = sanitizeEmail(item.email);
      item.phone = normalizePhone(item.phone);
      await item.save();
    }
    console.log(`[DONE] Cleaned ${tscData.length} TscData records.`);

    // 4. Clean Tasks
    console.log('[PROCESS] Cleaning Task collection...');
    const tasks = await Task.find({});
    for (const task of tasks) {
      task.title = sanitizeName(task.title);
      await task.save();
    }
    console.log(`[DONE] Cleaned ${tasks.length} tasks.`);

    console.log('[FINISH] All collections sanitized and deduplicated.');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Migration Script Failed:', err);
    process.exit(1);
  }
}

cleanData();
