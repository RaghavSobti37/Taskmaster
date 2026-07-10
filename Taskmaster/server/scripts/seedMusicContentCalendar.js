#!/usr/bin/env node
/**
 * Seed Music Content Calendar events from Music_Content_Calendar.pdf
 * Usage: node server/scripts/seedMusicContentCalendar.js [--year=2026] [--dry-run] [--prod]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { seedMusicContentCalendar } = require('../services/musicCalendarSeedService');

function parseArgs() {
  const yearArg = process.argv.find((a) => a.startsWith('--year='));
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/testing');
  if (useProd && !uri) {
    throw new Error('MONGODB_URI_PROD is not set in server/.env');
  }
  return {
    year: yearArg ? Number(yearArg.split('=')[1]) : new Date().getFullYear(),
    dryRun: process.argv.includes('--dry-run'),
    uri: uri.trim(),
    useProd,
  };
}

async function run() {
  const { year, dryRun, uri, useProd } = parseArgs();
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (${useProd ? 'production' : 'local'}) year=${year}${dryRun ? ', dry-run' : ''}`);

  const result = await seedMusicContentCalendar({ year, dryRun });
  console.log(`Creator: ${result.creator.name || result.creator.id} (tenant ${result.creator.tenantId || 'default'})`);
  console.log(`\nDone: ${result.created} created, ${result.updated} patched, ${result.skipped} unchanged (${result.total} total)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
