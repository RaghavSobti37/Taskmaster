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

  const allOfferings = await ExlyOffering.find({});
  console.log(`Migrating ${allOfferings.length} offerings...`);

  for (const offering of allOfferings) {
    const bookingsForOff = await ExlyBooking.find({ offeringId: offering.offeringId }).lean();
    const totalBookings = bookingsForOff.length;
    const totalRevenue = bookingsForOff.reduce((sum, b) => sum + (b.pricePaid || 0), 0);

    const leadsForOffering = await Lead.find({
      $or: [
        { exlyOfferingId: offering.offeringId },
        { exlyOfferingTitle: offering.title },
        { source: offering.title }
      ]
    }).lean();

    const convertedBookings = leadsForOffering.filter(l => l.leadStatus === 'Converted').length;
    const conversionRate = totalBookings > 0 ? Number(((convertedBookings / totalBookings) * 100).toFixed(1)) : 0;

    offering.totalBookings = totalBookings;
    offering.totalRevenue = totalRevenue;
    offering.conversionRate = conversionRate;
    await offering.save();
    console.log(`Updated Offering [${offering.offeringId}] -> totalBookings: ${totalBookings}, totalRevenue: ${totalRevenue}`);
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

run().catch(console.error);
