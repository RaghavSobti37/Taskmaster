#!/usr/bin/env node
/**
 * Seed Music Content Calendar events from Music_Content_Calendar.pdf
 * Usage: node server/scripts/seedMusicContentCalendar.js [--year=2026] [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const { startOfDayFromKey } = require('../utils/attendanceDate');

const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** { month: 'Jan', day: 5, type: 'Birthday', name: '...' } */
const MUSIC_CALENDAR_ENTRIES = [
  { month: 'Jan', day: 5, type: 'Birthday', name: 'Ustad Bismillah Khan' },
  { month: 'Jan', day: 8, type: 'Birthday', name: 'Elvis Presley' },
  { month: 'Jan', day: 27, type: 'Birthday', name: 'A. R. Rahman' },
  { month: 'Jan', day: 31, type: 'Birthday', name: 'Mohammed Rafi' },
  { month: 'Feb', day: 13, type: 'Observance', name: 'World Radio Day' },
  { month: 'Feb', day: 18, type: 'Birthday', name: 'Kumar Gandharva' },
  { month: 'Feb', day: 24, type: 'Birthday', name: 'Jagjit Singh' },
  { month: 'Feb', day: 25, type: 'Birthday', name: 'George Harrison' },
  { month: 'Mar', day: 4, type: 'Birthday', name: 'Shankar Mahadevan' },
  { month: 'Mar', day: 8, type: 'Observance', name: "International Women's Day" },
  { month: 'Mar', day: 21, type: 'Birthday', name: 'Ustad Amjad Ali Khan' },
  { month: 'Apr', day: 22, type: 'Birthday', name: 'Yehudi Menuhin' },
  { month: 'Apr', day: 30, type: 'Observance', name: 'International Jazz Day' },
  { month: 'May', day: 9, type: 'Birthday', name: 'Pandit Ravi Shankar' },
  { month: 'May', day: 24, type: 'Birthday', name: 'Bob Dylan' },
  { month: 'Jun', day: 21, type: 'Observance', name: 'World Music Day' },
  { month: 'Jun', day: 22, type: 'Birthday', name: 'Asha Bhosle' },
  { month: 'Jul', day: 6, type: 'Birthday', name: 'M. Balamuralikrishna' },
  { month: 'Jul', day: 26, type: 'Birthday', name: 'Mick Jagger' },
  { month: 'Aug', day: 1, type: 'Birthday', name: 'Kishore Kumar' },
  { month: 'Aug', day: 15, type: 'Observance', name: 'Indian Independence Day Music Content' },
  { month: 'Aug', day: 29, type: 'Birthday', name: 'Michael Jackson' },
  { month: 'Sep', day: 5, type: 'Birthday', name: 'Freddie Mercury' },
  { month: 'Sep', day: 23, type: 'Birthday', name: 'Ray Charles' },
  { month: 'Sep', day: 28, type: 'Birthday', name: 'Lata Mangeshkar' },
  { month: 'Oct', day: 1, type: 'Observance', name: 'International Music Day' },
  { month: 'Oct', day: 9, type: 'Birthday', name: 'John Lennon' },
  { month: 'Oct', day: 13, type: 'Birthday', name: 'Nusrat Fateh Ali Khan' },
  { month: 'Oct', day: 24, type: 'Birthday', name: 'R. D. Burman' },
  { month: 'Nov', day: 4, type: 'Birthday', name: 'P. Susheela' },
  { month: 'Nov', day: 12, type: 'Birthday', name: 'Pandit Bhimsen Joshi' },
  { month: 'Nov', day: 25, type: 'Memorial', name: 'George Harrison Death Anniversary' },
  { month: 'Dec', day: 8, type: 'Memorial', name: 'John Lennon Death Anniversary' },
  { month: 'Dec', day: 24, type: 'Birthday', name: 'Mohammed Rafi' },
  { month: 'Dec', day: 25, type: 'Observance', name: 'Christmas Music Content' },
];

const SOURCE_TAG = 'Music Content Calendar';

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

function buildEventTimes(month, day, year) {
  const dateKey = `${year}-${MONTHS[month]}-${String(day).padStart(2, '0')}`;
  const dayStart = startOfDayFromKey(dateKey);
  const start = new Date(dayStart.getTime() + 9 * 60 * 60 * 1000);
  const end = new Date(dayStart.getTime() + 10 * 60 * 60 * 1000);
  return { start, end, dateKey };
}

function buildTitle(entry) {
  return `${entry.type}: ${entry.name}`;
}

async function resolveCreatorUser() {
  const preferred = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).select('_id name');
  if (preferred) return preferred;
  const admin = await User.findOne({ role: 'admin' }).select('_id name');
  if (admin) return admin;
  const any = await User.findOne().select('_id name');
  if (!any) throw new Error('No users found — create a user before seeding calendar events');
  return any;
}

async function run() {
  const { year, dryRun, uri, useProd } = parseArgs();
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (${useProd ? 'production' : 'local'}) year=${year}${dryRun ? ', dry-run' : ''}`);

  const creator = await resolveCreatorUser();
  console.log(`Creator: ${creator.name || creator._id}`);

  let created = 0;
  let skipped = 0;

  for (const entry of MUSIC_CALENDAR_ENTRIES) {
    const title = buildTitle(entry);
    const { start, end, dateKey } = buildEventTimes(entry.month, entry.day, year);

    const existing = await CalendarEvent.findOne({
      title,
      date: { $gte: startOfDayFromKey(dateKey), $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) },
    }).select('_id title');

    if (existing) {
      skipped += 1;
      console.log(`  skip  ${dateKey}  ${title}`);
      continue;
    }

    const doc = {
      title,
      description: `${SOURCE_TAG} — ${entry.type}: ${entry.name}`,
      date: start,
      endDate: end,
      eventType: 'musical_day',
      visibility: 'public',
      workspace: '',
      projectId: null,
      createdBy: creator._id,
    };

    if (dryRun) {
      console.log(`  would ${dateKey}  ${title}`);
      created += 1;
      continue;
    }

    await CalendarEvent.create(doc);
    created += 1;
    console.log(`  added ${dateKey}  ${title}`);
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped (${MUSIC_CALENDAR_ENTRIES.length} total)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
