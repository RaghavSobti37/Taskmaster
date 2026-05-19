const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const ExlyBooking = require('../models/ExlyBooking');

async function run() {
  try {
    await mongoose.connect(dbUri);
    const bookingByTxn = await ExlyBooking.findOne({ transactionId: "8448883" }).lean();
    console.log('Booking by Txn ID 8448883:', JSON.stringify(bookingByTxn, null, 2));

    const bookingByEmail = await ExlyBooking.findOne({ email: "raghavishaan@gmail.com" }).lean();
    console.log('Booking by Email:', JSON.stringify(bookingByEmail, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
