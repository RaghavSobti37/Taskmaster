const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const ExlyBooking = require('../models/ExlyBooking');

async function run() {
  try {
    await mongoose.connect(dbUri);
    const count = await ExlyBooking.countDocuments();
    console.log('Total bookings:', count);

    const latest = await ExlyBooking.find().sort({ createdAt: -1 }).limit(5).lean();
    console.log('Latest 5 bookings in DB:', JSON.stringify(latest, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
