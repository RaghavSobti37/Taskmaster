#!/usr/bin/env node
/**
 * QA / admin scripts: resolve actor user id from env or PlatformSettings in MongoDB.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getQaAdminUserId, OBJECT_ID_RE } = require('../../shared/platformUserIds');

async function resolveScriptAdminUserId() {
  const fromEnv = String(process.env.QA_ADMIN_USER_ID || '').trim();
  if (OBJECT_ID_RE.test(fromEnv)) return fromEnv;

  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
  if (!uri) {
    throw new Error('Set QA_ADMIN_USER_ID or MONGODB_URI — or assign QA admin on Admin → Users → Platform roles');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    const { loadPlatformSettings } = require('../services/platformSettingsService');
    await loadPlatformSettings();
    const id = getQaAdminUserId();
    if (!OBJECT_ID_RE.test(id || '')) {
      throw new Error('Assign QA admin actor in Admin → Users → Platform roles (or set QA_ADMIN_USER_ID)');
    }
    return id;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { resolveScriptAdminUserId };
