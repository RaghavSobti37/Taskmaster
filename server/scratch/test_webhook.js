const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const ExlyBooking = require('../models/ExlyBooking');

async function test() {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected to Database');

    // 1. Clean up any existing test bookings for this email
    await ExlyBooking.deleteMany({ email: 'raghavtest@gmail.com' });
    console.log('Cleaned old test bookings.');

    const initialCount = await ExlyBooking.countDocuments({ email: 'raghavtest@gmail.com' });
    console.log('Initial count of test bookings:', initialCount);

    const payload = {
      name: "Raghav Webhook Test",
      email: "raghavtest@gmail.com",
      phone: "919999999999",
      price: 0,
      offeringTitle: "TSC Academy Artist Path Meetup",
      offeringId: "tsc-academy-artist-path-meetup"
    };

    console.log('Sending first webhook request...');
    const res1 = await axios.post('http://localhost:5000/api/exly/webhook', payload);
    console.log('First response:', res1.data);

    const countAfterFirst = await ExlyBooking.countDocuments({ email: 'raghavtest@gmail.com' });
    console.log('Count of test bookings after first trigger:', countAfterFirst);

    console.log('Sending second webhook request...');
    const res2 = await axios.post('http://localhost:5000/api/exly/webhook', payload);
    console.log('Second response:', res2.data);

    const countAfterSecond = await ExlyBooking.countDocuments({ email: 'raghavtest@gmail.com' });
    console.log('Count of test bookings after second trigger:', countAfterSecond);

    if (countAfterSecond === 1) {
      console.log('✅ SUCCESS: Webhook did not create a duplicate booking!');
    } else {
      console.log('❌ FAILURE: Duplicate booking was created!');
    }

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

test();
