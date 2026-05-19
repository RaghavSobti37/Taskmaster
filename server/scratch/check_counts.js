const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const Lead = require('../models/Lead');

async function run() {
  const dbUri = process.env.MONGODB_URI;
  await mongoose.connect(dbUri);
  console.log('Connected to DB');

  const totalBookings = await ExlyBooking.countDocuments();
  console.log('Total bookings in ExlyBooking:', totalBookings);

  const bookings = await ExlyBooking.find().lean();
  const uniqueKeys = new Set();
  bookings.forEach(b => {
    const key = `${b.email?.toLowerCase().trim() || ''}-${b.phone?.trim() || ''}`;
    uniqueKeys.add(key);
  });
  console.log('Unique keys in ExlyBooking (email-phone):', uniqueKeys.size);

  const offerings = await ExlyOffering.find().lean();
  console.log('Total offerings:', offerings.length);
  const sumOfferingBookings = offerings.reduce((sum, o) => sum + (o.totalBookings || 0), 0);
  console.log('Sum of totalBookings across offerings:', sumOfferingBookings);

  const totalLeads = await Lead.countDocuments();
  console.log('Total CRM leads:', totalLeads);

  const exlyLeads = await Lead.countDocuments({
    $or: [
      { exlyOfferingId: { $exists: true, $ne: '' } },
      { exlyOfferingTitle: { $exists: true, $ne: '' } }
    ]
  });
  console.log('CRM leads matching Exly filters:', exlyLeads);

  process.exit(0);
}

run().catch(console.error);
