const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Lead = require('../models/Lead');
const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const User = require('../models/User');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');
const { assignLeadToRep } = require('../controllers/crmController');

const CUSTOMERS_CSV = path.join(__dirname, '../../Customers_3241819_642b.csv');
const BOOKINGS_CSV = path.join(__dirname, '../../MyBookings_3241819_cc3a.csv');
const TRANSACTIONS_CSV = path.join(__dirname, '../../Transactions_3241819_6bea.csv');

// Helper to parse dates in various formats
function parseExlyDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return new Date();
  const cleaned = dateStr.replace(/"/g, '').trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Helper to parse price/spend
function parseAmount(amountStr) {
  if (!amountStr || amountStr === 'N/A') return 0;
  const cleaned = amountStr.replace(/[₹\s,]/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

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

const shouldIgnoreOffering = (title, offeringId) => {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  const lowerId = (offeringId || '').toLowerCase().trim();
  return lower === 'testing br community' || 
         lower === 'program name' || 
         lower === 'testing' ||
         lower === 'demo community' ||
         lower === 'demo day- results' ||
         lowerId === 'demo-community' ||
         lowerId === 'demo-day--results';
};

async function importExlyData() {
  try {
    const dbUri = process.env.MONGODB_URI;
    if (!dbUri) throw new Error('MONGODB_URI not found in .env');

    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');

    // 1. Purge ignored offerings immediately
    await ExlyOffering.deleteMany({
      title: { $in: [/testing BR community/i, /Program Name/i, /testing/i] }
    });

    console.log('⏳ Parsing Customers CSV...');
    const customerMap = new Map(); // key: email or phone -> totalSpent
    await new Promise((resolve) => {
      fs.createReadStream(CUSTOMERS_CSV)
        .pipe(csv())
        .on('data', (row) => {
          const email = sanitizeEmail(row.Email);
          const phone = normalizePhone(row['Phone Number']);
          const totalSpent = parseAmount(row['Total Spent']);
          if (email) customerMap.set(email, totalSpent);
          if (phone) customerMap.set(phone, totalSpent);
        })
        .on('end', resolve);
    });
    console.log(`✅ Loaded ${customerMap.size} customer spending profiles`);

    // 2. Load Transactions mapping
    console.log('⏳ Parsing Transactions CSV...');
    const transactionMap = new Map(); // key: email/phone + offeringName + dateSnippet -> details
    await new Promise((resolve) => {
      fs.createReadStream(TRANSACTIONS_CSV)
        .pipe(csv())
        .on('data', (row) => {
          const email = sanitizeEmail(row['Customer Email']);
          const phone = normalizePhone(row['Customer Phone Number']);
          const rawOffering = row['Offering Name'] || '';
          if (shouldIgnoreOffering(rawOffering)) return;

          const { cleanTitle } = parseOfferingTitle(rawOffering);
          const offering = cleanTitle.trim().toLowerCase();
          const dateStr = (row['Transaction Date'] || '').trim();
          const txnId = row['Transaction Id'] || row['Transaction ID'] || '';
          const custId = row['Customer Id'] || '';
          const state = row['State'] || '';
          const payoutStatus = row['Payout Status'] || '';

          const keyParts = [];
          if (email) keyParts.push(email);
          if (phone) keyParts.push(phone);
          
          keyParts.forEach(contact => {
            const mapKey = `${contact}|${offering}|${dateStr.substring(0, 11)}`;
            transactionMap.set(mapKey, { txnId, custId, state, payoutStatus });
          });
        })
        .on('end', resolve);
    });
    console.log(`✅ Loaded ${transactionMap.size} transaction entries`);

    // Get reps for assignment
    const reps = await User.find({ role: 'sales' }).lean();
    console.log(`ℹ️ Found ${reps.length} sales reps for round-robin assignment`);
    let repIndex = 0;

    // 3. Load Bookings
    console.log('⏳ Parsing Bookings CSV & building database entries...');
    const bookings = [];
    await new Promise((resolve) => {
      fs.createReadStream(BOOKINGS_CSV)
        .pipe(csv())
        .on('data', (row) => {
          const rawOffering = row.Offering || '';
          if (!shouldIgnoreOffering(rawOffering)) {
            bookings.push(row);
          }
        })
        .on('end', resolve);
    });

    console.log(`ℹ️ Found ${bookings.length} non-ignored booking rows to process`);

    let count = 0;
    const offeringsMap = new Map(); // slug -> offering data

    const batchSize = 100;
    for (let i = 0; i < bookings.length; i += batchSize) {
      const batch = bookings.slice(i, i + batchSize);
      const bookingBulkOps = [];
      const leadBulkOps = [];

      // Gather batch phones and emails
      const batchPhones = [];
      const batchEmails = [];
      for (const row of batch) {
        const p = normalizePhone(row['Phone Number'] || '');
        const e = sanitizeEmail(row.Email || '');
        if (p) batchPhones.push(p);
        if (e) batchEmails.push(e);
      }

      // Fetch matching leads
      const matchingLeads = await Lead.find({
        $or: [
          { phone: { $in: batchPhones } },
          { email: { $in: batchEmails } }
        ]
      }).lean();

      // Build lead lookup map
      const leadMap = new Map();
      matchingLeads.forEach(l => {
        if (l.phone) leadMap.set(l.phone, l);
        if (l.email) leadMap.set(l.email, l);
      });

      for (const row of batch) {
        const rawName = row.Name || 'Exly Customer';
        const rawPhone = row['Phone Number'] || '';
        const rawEmail = row.Email || '';
        const phone = normalizePhone(rawPhone);
        const email = sanitizeEmail(rawEmail);

        if (!phone && !email) continue;

        const name = sanitizeName(rawName);
        const rawOfferingTitle = (row.Offering || 'Exly Offering').trim();
        const { cleanTitle, dateStr, timeStr } = parseOfferingTitle(rawOfferingTitle);
        const offeringSlug = cleanTitle.toLowerCase().replace(/\s+/g, '-');
        const pricePaid = parseAmount(row['Price Paid']);
        const bookedOn = parseExlyDate(row['Booked On']);
        const offeringType = row['Offering Type'] || 'program';

        // Check transaction details
        const dateSnippet = (row['Booked On'] || '').trim().substring(0, 11);
        let txnDetails = null;
        if (email) txnDetails = transactionMap.get(`${email}|${cleanTitle.toLowerCase()}|${dateSnippet}`);
        if (!txnDetails && phone) txnDetails = transactionMap.get(`${phone}|${cleanTitle.toLowerCase()}|${dateSnippet}`);

        const txnId = txnDetails?.txnId || '';
        const custId = txnDetails?.custId || '';
        const state = txnDetails?.state || '';
        const payoutStatus = txnDetails?.payoutStatus || '';

        // Register offering in offeringsMap
        if (!offeringsMap.has(offeringSlug)) {
          offeringsMap.set(offeringSlug, {
            offeringId: offeringSlug,
            title: cleanTitle,
            eventDate: dateStr,
            eventTime: timeStr,
            type: offeringType,
            price: pricePaid,
            status: 'active'
          });
        } else {
          const existing = offeringsMap.get(offeringSlug);
          if (pricePaid > existing.price) {
            existing.price = pricePaid;
          }
        }

        // Add ExlyBooking upsert operation
        bookingBulkOps.push({
          updateOne: {
            filter: { email, phone, offeringId: offeringSlug, bookedOn },
            update: {
              $set: {
                name,
                email,
                phone,
                offeringTitle: cleanTitle,
                offeringId: offeringSlug,
                pricePaid,
                bookedOn,
                paymentType: row['Payment Type'] || '',
                debitType: row['Debit Type'] || '',
                offeringType,
                offeringOwner: row['Offering Owner'] || '',
                promotionType: row['Promotion Type'] || '',
                promotionFromOffering: row['Promotion From Offering'] || '',
                transactionId: txnId,
                customerId: custId,
                state,
                payoutStatus
              }
            },
            upsert: true
          }
        });

        // Add Lead update operation (update-only, no upsert/creation)
        const existingLead = (phone && leadMap.get(phone)) || (email && leadMap.get(email));
        if (existingLead) {
          leadBulkOps.push({
            updateOne: {
              filter: { _id: existingLead._id },
              update: {
                $set: {
                  customerIdExly: custId || existingLead.customerIdExly,
                  transactionIdExly: txnId || existingLead.transactionIdExly,
                  exlyOfferingId: offeringSlug || existingLead.exlyOfferingId,
                  exlyOfferingTitle: cleanTitle || existingLead.exlyOfferingTitle
                }
              }
            }
          });
        }
      }

      if (bookingBulkOps.length > 0) {
        await ExlyBooking.bulkWrite(bookingBulkOps);
      }
      if (leadBulkOps.length > 0) {
        await Lead.bulkWrite(leadBulkOps);
      }

      count += batch.length;
      if (count % 1000 === 0 || count === bookings.length) {
        console.log(`[PROGRESS] Processed ${count}/${bookings.length} bookings...`);
      }
    }

    // 4. Save Exly offerings and calculate metrics
    console.log('⏳ Saving Exly offerings...');
    for (const [slug, offeringData] of offeringsMap.entries()) {
      const bookingsForOff = await ExlyBooking.find({ offeringId: slug }).lean();
      const totalBookings = bookingsForOff.length;
      const totalRevenue = bookingsForOff.reduce((sum, b) => sum + b.pricePaid, 0);

      await ExlyOffering.findOneAndUpdate(
        { offeringId: slug },
        {
          $set: {
            title: offeringData.title,
            eventDate: offeringData.eventDate,
            eventTime: offeringData.eventTime,
            type: offeringData.type,
            price: offeringData.price,
            currency: 'INR',
            status: 'active',
            totalBookings,
            totalRevenue,
            conversionRate: 0
          }
        },
        { upsert: true }
      );
    }
    console.log('✅ Offerings synced');

    // 5. Update conversion rates
    console.log('⏳ Recalculating conversion rates for offerings...');
    const allOfferings = await ExlyOffering.find();
    for (const offering of allOfferings) {
      const leads = await Lead.find({
        $or: [
          { exlyOfferingId: offering.offeringId },
          { exlyOfferingTitle: offering.title },
          { source: offering.title }
        ]
      }).lean();

      const totalL = leads.length;
      const converted = leads.filter(l => l.leadStatus === 'Converted').length;
      offering.totalBookings = totalL;
      offering.conversionRate = totalL > 0 ? Number(((converted / totalL) * 100).toFixed(1)) : 0;
      await offering.save();
    }

    console.log('✨ [SUCCESS] Exly CSV Import & Hydration Completed Successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ [ERROR] Import failed:', err.message);
    process.exit(1);
  }
}

importExlyData();
