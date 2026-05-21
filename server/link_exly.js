require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./models/Lead');
const ExlyBooking = require('./models/ExlyBooking');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const bookings = await ExlyBooking.find().lean();
  let updatedCount = 0;

  for (const b of bookings) {
    if (!b.email && !b.phone) continue;

    const filter = [];
    if (b.email) filter.push({ email: b.email });
    if (b.phone) filter.push({ phone: b.phone });

    const leads = await Lead.find({ $or: filter });
    for (const lead of leads) {
      // Update lead if it doesn't have the exly Offering
      if (!lead.exlyOfferingTitle || lead.exlyOfferingTitle !== b.offeringTitle) {
        lead.exlyOfferingTitle = b.offeringTitle;
        lead.exlyOfferingId = b.offeringId;
        lead.customerIdExly = b.customerId;
        lead.transactionIdExly = b.transactionId;
        await lead.save();
        updatedCount++;
      }
    }
  }

  console.log('Linked', updatedCount, 'leads with Exly offerings based on matching email/phone.');
  process.exit(0);
});
