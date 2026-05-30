/**
 * Check for duplicate attendance rows before enforcing { userId, date } unique index.
 * Usage: node scripts/checkAttendanceDuplicates.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const dupes = await Attendance.aggregate([
    {
      $group: {
        _id: { userId: '$userId', date: '$date' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  if (dupes.length === 0) {
    console.log('No duplicate attendance rows found. Safe to deploy unique index.');
  } else {
    console.log(`Found ${dupes.length} duplicate userId+date groups:`);
    dupes.slice(0, 20).forEach((row) => {
      console.log(`  userId=${row._id.userId} date=${row._id.date} count=${row.count} ids=${row.ids.join(',')}`);
    });
    if (dupes.length > 20) console.log(`  ... and ${dupes.length - 20} more`);
    process.exitCode = 1;
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
