#!/usr/bin/env node
/**
 * Update "Raghav Signature" HTML on a legacy EmailProfile.
 *
 * Run from repo root:
 *   node server/scripts/seedRaghavSignature.js
 *
 * New campaign sender profiles now belong in Auto-Mailer.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EmailProfile = require('../models/EmailProfile');

const RAGHAV_SIGNATURE = `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; line-height: 1.4;">
  <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px; color: #C15717;">
    RAGHAV RAJ SOBTI
  </div>
  <div style="font-size: 12px; color: #444; margin-bottom: 8px;">
     Cinematographer | Developer
  </div>
  <div style="font-size: 12px;">
    +91 85914 99393<br>
    <a href="mailto:redacted@example.com" style="color: #222; text-decoration: none;">redacted@example.com</a> | 
    <a href="https://bluepolaroid.com" style="color: #C15717; text-decoration: none;">bluepolaroid.com</a>
  </div>
</div>`;

const PROFILE_NAME = 'Raghav Signature';
const PROFILE_EMAIL = 'redacted@example.com';

const run = async () => {
  const dbUri = (process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/testing').trim();
  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  let profile = await EmailProfile.findOne({ name: PROFILE_NAME }).setOptions({ bypassTenant: true });
  if (!profile) {
    profile = await EmailProfile.findOne({ name: /^Raghav$/i }).setOptions({ bypassTenant: true });
  }
  if (!profile) {
    profile = await EmailProfile.findOne({ name: /Raghav/i }).setOptions({ bypassTenant: true });
  }

  if (profile) {
    profile.signature = RAGHAV_SIGNATURE;
    if (profile.name !== PROFILE_NAME) {
      profile.name = PROFILE_NAME;
    }
    await profile.save();
    console.log(`Updated profile "${profile.name}" (${profile._id}) with Raghav Signature HTML.`);
  } else {
    console.error('No matching legacy EmailProfile found. Create or edit sender profiles in Auto-Mailer.');
    process.exit(1);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
