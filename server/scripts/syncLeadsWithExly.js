require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const ExlyBooking = require('../models/ExlyBooking');
const Contact = require('../models/Contact');
const ContactService = require('../services/ContactService');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('Connected to DB');

  const leads = await Lead.find({});
  let leadUpdated = 0;
  for (const lead of leads) {
    const filter = { $or: [] };
    if (lead.email) filter.$or.push({ email: lead.email });
    if (lead.phone) filter.$or.push({ phone: lead.phone });
    
    if (filter.$or.length > 0) {
      const allExlyMatches = await ExlyBooking.find(filter).sort({ bookedOn: -1 });
      
      if (allExlyMatches.length > 0) {
        const updatePayload = {};
        
        // Populate the new exlyOfferings array
        const uniqueOfferings = new Map();
        allExlyMatches.forEach(match => {
          if (!uniqueOfferings.has(match.offeringId)) {
            uniqueOfferings.set(match.offeringId, {
              offeringId: match.offeringId,
              title: match.offeringTitle,
              purchasedAt: match.bookedOn || match.createdAt
            });
          }
        });
        updatePayload.exlyOfferings = Array.from(uniqueOfferings.values());
        
        // Legacy single-title support
        const latestMatch = allExlyMatches[0];
        if (!lead.exlyOfferingTitle) {
          updatePayload.exlyOfferingTitle = latestMatch.offeringTitle;
          updatePayload.exlyOfferingId = latestMatch.offeringId;
        }
        if (lead.source === 'Exly Offering') {
          updatePayload.source = latestMatch.offeringTitle;
        }
        
        if (Object.keys(updatePayload).length > 0) {
          await Lead.updateOne({ _id: lead._id }, { $set: updatePayload });
          leadUpdated++;
        }
      }

      await ContactService.mergeContact({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        leadStatus: lead.leadStatus,
        leadQuality: lead.leadQuality
      }, 'crm');
    }
  }

  const bookings = await ExlyBooking.find({});
  for (const b of bookings) {
    await ContactService.mergeContact({
      name: b.name,
      email: b.email,
      phone: b.phone,
      exlyOfferingTitle: b.offeringTitle
    }, 'exly');
  }

  console.log(`Finished. Updated ${leadUpdated} leads with Exly tags. Synced all to Contacts.`);
  process.exit(0);
}

run().catch(console.error);
