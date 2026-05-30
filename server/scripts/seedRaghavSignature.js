#!/usr/bin/env node
/**
 * Upsert "Raghav Signature" HTML on an EmailProfile.
 *
 * Run from repo root:
 *   node server/scripts/seedRaghavSignature.js
 *
 * Optional env (for creating a new profile when none matches):
 *   SEED_SMTP_USER, SEED_SMTP_PASS — SMTP credentials for new profile
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
    <a href="mailto:raghavsobti37@gmail.com" style="color: #222; text-decoration: none;">raghavsobti37@gmail.com</a> | 
    <a href="https://bluepolaroid.com" style="color: #C15717; text-decoration: none;">bluepolaroid.com</a>
  </div>
</div>`;

const PROFILE_NAME = 'Raghav Signature';
const PROFILE_EMAIL = 'raghavsobti37@gmail.com';

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
    const smtpUser = (process.env.SEED_SMTP_USER || PROFILE_EMAIL).trim();
    const smtpPass = (process.env.SEED_SMTP_PASS || '').trim();
    if (!smtpPass) {
      console.error('No matching EmailProfile found. Set SEED_SMTP_PASS (and optionally SEED_SMTP_USER) to create one.');
      process.exit(1);
    }
    profile = await EmailProfile.create({
      name: PROFILE_NAME,
      email: PROFILE_EMAIL,
      smtpUser,
      smtpPass,
      smtpHost: 'rotation',
      signature: RAGHAV_SIGNATURE,
    });
    console.log(`Created profile "${profile.name}" (${profile._id}) with Raghav Signature HTML.`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
