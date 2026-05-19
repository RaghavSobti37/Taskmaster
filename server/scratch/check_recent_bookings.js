const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const ExlyBooking = require('../models/ExlyBooking');

async function run() {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected');

    // Find bookings created/updated in the last 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const bookings = await ExlyBooking.find({
      updatedAt: { $gte: thirtyMinsAgo }
    }).lean();

    console.log('Bookings in last 30 minutes:', JSON.stringify(bookings, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
