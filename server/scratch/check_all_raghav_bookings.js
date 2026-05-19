const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const ExlyBooking = require('../models/ExlyBooking');

async function run() {
  try {
    await mongoose.connect(dbUri);
    const bookings = await ExlyBooking.find({ email: "raghavishaan@gmail.com" }).lean();
    console.log('All bookings for raghavishaan@gmail.com:', JSON.stringify(bookings, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
