#!/usr/bin/env node
/**
 * Masterclass → course funnel from Exly bookings + CRM Converted leads.
 * Usage:
 *   node server/scripts/analyzeMasterclassConversion.js --prod
 *   node server/scripts/analyzeMasterclassConversion.js --prod --json
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { buildMasterclassFunnelReport } = require('../services/masterclassFunnelReport');

const useProd = process.argv.includes('--prod');
const asJson = process.argv.includes('--json');
const uri = useProd ? (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI) : process.env.MONGODB_URI;

async function buildReport() {
  const report = await buildMasterclassFunnelReport();
  return { ...report, source: 'Exly bookings + CRM Converted leads' };
}

function printText(report) {
  const { summary, themes, sessions } = report;
  console.log('\n=== Masterclass → Course (Exly + CRM) ===\n');
  console.log(`Sessions: ${summary.masterclassSessions}`);
  console.log(`Registrations → Course enrollments: ${summary.totalRegistrations} → ${summary.totalCourseEnrollments} (${summary.overallConversionRate}%)`);
  console.log(`Typical session with conversions: ${summary.medianEnrollmentsPerSession} students (avg ${summary.avgEnrollmentsPerSession})\n`);

  console.log('--- By masterclass theme ---');
  for (const t of themes) {
    console.log(`  ${t.masterclass}`);
    console.log(`    ${t.registrations} regs · ${t.courseEnrollments} course enrollments · ${t.conversionRate}% · ${t.sessions} session(s) · ${t.mentor}`);
  }

  console.log('\n--- Each session: Masterclass → Course ---');
  console.log('Regs | Course | % | Masterclass session');
  for (const s of sessions) {
    const courses = s.coursesEnrolled.map((c) => `${c.count}→${c.course.slice(0, 35)}`).join('; ') || '—';
    console.log(
      `${String(s.registrations).padStart(4)} | ${String(s.courseEnrollments).padStart(6)} | ${String(s.conversionRate).padStart(4)}% | ${s.sessionLabel.slice(0, 55)}`
    );
    if (s.courseEnrollments) console.log(`       courses: ${courses}`);
  }
}

async function main() {
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const report = await buildReport();
  await mongoose.disconnect();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printText(report);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
