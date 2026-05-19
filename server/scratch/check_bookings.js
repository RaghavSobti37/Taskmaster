const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const ExlyBooking = require('../models/ExlyBooking');
const Lead = require('../models/Lead');

async function run() {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected to DB');

    const bookings = await ExlyBooking.find({
      $or: [
        { email: /raghavishaan/i },
        { phone: /918591499393/ },
        { name: /raghav/i }
      ]
    }).lean();

    console.log('--- FOUND EXLY BOOKINGS ---');
    console.log(JSON.stringify(bookings, null, 2));

    const leads = await Lead.find({
      $or: [
        { email: /raghavishaan/i },
        { phone: /918591499393/ },
        { name: /raghav/i }
      ]
    }).lean();

    console.log('--- FOUND CRM LEADS ---');
    console.log(JSON.stringify(leads, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
