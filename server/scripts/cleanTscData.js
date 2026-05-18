require('dotenv').config();
const mongoose = require('mongoose');
const TscData = require('../models/TscData');
const { sanitizeName, sanitizeEmail, normalizePhone } = require('../utils/sanitizer');

const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot').trim();

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

async function cleanTsc() {
  try {
    console.log('[START] Cleaning TscData (All Data) collection...');
    await mongoose.connect(dbUri);
    console.log('[SUCCESS] Connected to MongoDB');

    const totalBefore = await TscData.countDocuments();
    console.log(`[INFO] Total records before cleaning: ${totalBefore}`);

    // 1. Remove records missing either email or phone initially
    const deleteRes = await TscData.deleteMany({
      $or: [
        { email: { $exists: false } },
        { email: null },
        { email: '' },
        { phone: { $exists: false } },
        { phone: null },
        { phone: '' }
      ]
    });
    console.log(`[CLEANUP] Removed ${deleteRes.deletedCount} records missing either email or phone.`);

    // 2. Iterate remaining records for strict validation, sanitization, and deduplication
    const remaining = await TscData.find({}).sort({ createdAt: 1 });
    const seen = new Set();
    let invalidRemoved = 0;
    let duplicatesRemoved = 0;
    let sanitizedCount = 0;

    for (const doc of remaining) {
      const cleanEmail = sanitizeEmail(doc.email);
      const cleanPhone = normalizePhone(doc.phone);
      const cleanName = sanitizeName(doc.name) || 'Unknown';

      // Check strict validity
      if (!isValidEmail(cleanEmail) || !isValidPhone(cleanPhone)) {
        await TscData.deleteOne({ _id: doc._id });
        invalidRemoved++;
        continue;
      }

      // Check for duplicates
      const key = `${cleanPhone}|${cleanEmail}`;
      if (seen.has(key)) {
        await TscData.deleteOne({ _id: doc._id });
        duplicatesRemoved++;
        continue;
      }

      seen.add(key);

      // Save sanitized values
      doc.name = cleanName;
      doc.email = cleanEmail;
      doc.phone = cleanPhone;
      await doc.save();
      sanitizedCount++;
    }

    const totalAfter = await TscData.countDocuments();
    console.log(`[SUMMARY] Invalid records removed: ${invalidRemoved}`);
    console.log(`[SUMMARY] Duplicates removed: ${duplicatesRemoved}`);
    console.log(`[SUMMARY] Successfully sanitized records: ${sanitizedCount}`);
    console.log(`[SUCCESS] Total records remaining: ${totalAfter}`);

    // Clean up temporary inspection script
    try {
      const fs = require('fs');
      const path = require('path');
      fs.unlinkSync(path.join(__dirname, 'inspectTsc.js'));
    } catch(e) {}

    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Cleaning script failed:', err);
    process.exit(1);
  }
}

cleanTsc();
