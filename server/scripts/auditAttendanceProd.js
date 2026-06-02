/**
 * One-off audit: production attendance workMode + verification (no secrets printed).
 * Usage: node scripts/auditAttendanceProd.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { todayStart, getDateKey } = require('../utils/attendanceDate');

async function main() {
  const uri = (process.env.MONGODB_URI_PROD || '').trim();
  if (!uri) {
    console.error('MONGODB_URI_PROD not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const today = todayStart();

  console.log('=== Env (local .env — prod Render may differ) ===');
  console.log('OFFICE_PUBLIC_IP:', process.env.OFFICE_PUBLIC_IP ? `set (${process.env.OFFICE_PUBLIC_IP.length} chars)` : 'UNSET');
  console.log('OFFICE_IP_WHITELIST:', process.env.OFFICE_IP_WHITELIST ? `set (${process.env.OFFICE_IP_WHITELIST.length} chars)` : 'UNSET');
  console.log('Code reads: OFFICE_PUBLIC_IP only (OFFICE_IP_WHITELIST is IGNORED)');
  console.log('Geofence: 19.9975, 73.7898 — radius 1000m\n');

  const rows = await Attendance.find({ date: today }).sort({ updatedAt: -1 }).lean();
  console.log(`=== Today ${getDateKey(today)} — ${rows.length} record(s) ===`);
  for (const r of rows) {
    const u = await User.findById(r.userId).select('email name').lean();
    console.log(JSON.stringify({
      user: u?.email,
      inTime: r.inTimeRecord?.manualTimestamp,
      inMode: r.inTimeRecord?.workMode,
      inMethod: r.inTimeRecord?.verificationMethod,
      inIp: r.inTimeRecord?.checkInIp,
      outMode: r.outTimeRecord?.workMode,
      outMethod: r.outTimeRecord?.verificationMethod,
      outIp: r.outTimeRecord?.checkOutIp,
    }, null, 0));
  }

  const raghav = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).select('_id').lean();
  if (raghav) {
    const mine = await Attendance.find({ userId: raghav._id }).sort({ date: -1 }).limit(7).lean();
    console.log('\n=== REDACTED_ADMIN@example.com — last 7 days ===');
    for (const r of mine) {
      console.log(JSON.stringify({
        date: getDateKey(r.date),
        inMode: r.inTimeRecord?.workMode,
        inMethod: r.inTimeRecord?.verificationMethod,
        inIp: r.inTimeRecord?.checkInIp,
        outMode: r.outTimeRecord?.workMode,
        outMethod: r.outTimeRecord?.verificationMethod,
      }));
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
