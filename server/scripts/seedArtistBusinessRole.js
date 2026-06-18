#!/usr/bin/env node

/**
 * Ensures the Artist Business org role exists (role-based, not user-specific).
 * Assign users (e.g. Akash) via Admin → Users → department "Artist Business".
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Department = require('../models/Department');
const { PRESET_PAGES } = require('../utils/pagePermissions');

const ROLE = {
  name: 'Artist Business',
  slug: 'artist-business',
  sortOrder: 2,
  signupAllowed: false,
  permissionPreset: 'artist-business',
  pagePermissions: PRESET_PAGES['artist-business'],
};

async function main() {
  const uri = process.env.MONGODB_URI_PROD || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not configured');
    process.exit(1);
  }

  await mongoose.connect(uri.trim());
  let dept = await Department.findOne({ slug: ROLE.slug });
  if (dept) {
    console.log(`Artist Business role already exists (${dept._id})`);
  } else {
    dept = await Department.create(ROLE);
    console.log(`Created Artist Business role (${dept._id})`);
  }
  console.log('Assign users in Admin → Users → set department to Artist Business.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
