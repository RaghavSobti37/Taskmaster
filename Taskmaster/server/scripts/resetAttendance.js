/**
 * One-time script to wipe all attendance + leave request records.
 * Usage: node scripts/resetAttendance.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const [attendance, leave] = await Promise.all([
    Attendance.deleteMany({}),
    LeaveRequest.deleteMany({}),
  ]);
  console.log(`Deleted ${attendance.deletedCount} attendance rows and ${leave.deletedCount} leave requests.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
