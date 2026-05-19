const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Lead = require('../models/Lead');
const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');

const parseOfferingTitle = (title) => {
  if (!title) return { cleanTitle: '', dateStr: '', timeStr: '' };
  const parts = title.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    return {
      cleanTitle: parts.slice(2).join(' | '),
      dateStr: parts[0],
      timeStr: parts[1]
    };
  } else if (parts.length === 2) {
    return {
      cleanTitle: parts[1],
      dateStr: parts[0],
      timeStr: ''
    };
  }
  return { cleanTitle: title, dateStr: '', timeStr: '' };
};

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const payload = {
    name: "Raghav Test Webhook",
    email: "raghavishaan@gmail.com",
    phone: "918591499393",
    price: 0,
    offeringTitle: "TSC Academy Artist Path Meetup"
  };

  const rawPhone = payload.phone || '';
  const rawEmail = payload.email || '';
  const phone = normalizePhone(rawPhone);
  const email = sanitizeEmail(rawEmail);

  console.log('Normalized phone:', phone, 'email:', email);

  const rawOfferingTitle = payload.offeringTitle || 'Exly Offering';
  const offeringId = payload.offeringId || '';
  const { cleanTitle, dateStr, timeStr } = parseOfferingTitle(rawOfferingTitle);

  const name = sanitizeName(payload.name || 'Exly Lead');
  const txnId = payload.transactionId || '';
  const custId = payload.customerId || '';
  const price = payload.price || 0;

  const offId = offeringId || cleanTitle.toLowerCase().replace(/\s+/g, '-');
  console.log('computed offId:', offId);

  // 1. Sync or Create Exly Offering
  const savedOffering = await ExlyOffering.findOneAndUpdate(
    { offeringId: offId },
    {
      $set: {
        title: cleanTitle,
        eventDate: dateStr,
        eventTime: timeStr,
        type: payload.offeringType || 'program',
        price: price,
        currency: payload.currency || 'INR',
        status: 'active'
      }
    },
    { upsert: true, new: true }
  );
  console.log('Saved Offering:', savedOffering);

  // 2. Sync lead into CRM
  const filter = { $or: [] };
  if (phone) filter.$or.push({ phone });
  if (email) filter.$or.push({ email });

  let lead = null;
  if (filter.$or.length > 0) {
    lead = await Lead.findOne(filter);
    console.log('Found existing lead before save:', lead);
    if (lead) {
      lead.name = name || lead.name;
      lead.customerIdExly = custId || lead.customerIdExly;
      lead.transactionIdExly = txnId || lead.transactionIdExly;
      lead.exlyOfferingId = offId || lead.exlyOfferingId;
      lead.exlyOfferingTitle = cleanTitle || lead.exlyOfferingTitle;
      
      // Let's also update email if it is missing
      lead.email = email || lead.email;
      
      console.log('Updating lead values on model object:', {
        name: lead.name,
        customerIdExly: lead.customerIdExly,
        transactionIdExly: lead.transactionIdExly,
        exlyOfferingId: lead.exlyOfferingId,
        exlyOfferingTitle: lead.exlyOfferingTitle,
        email: lead.email
      });
      await lead.save();
      console.log('Saved Lead successfully');
    }
  }

  // Reload lead to verify it was updated
  const reloadedLead = await Lead.findOne(filter).lean();
  console.log('Reloaded Lead from DB:', reloadedLead);

  await mongoose.disconnect();
}

run().catch(console.error);
