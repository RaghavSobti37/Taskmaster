const axios = require('axios');
const Lead = require('../models/Lead');
const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');

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

class ExlyService {
  getCredentials() {
    return {
      apiKey: process.env.EXLY_API_KEY || '',
      apiUrl: process.env.EXLY_API_URL || 'https://api.exly.com'
    };
  }

  async fetchOfferings() {
    const { apiKey, apiUrl } = this.getCredentials();
    if (!apiKey) {
      throw new Error('Exly API key is not configured in .env settings.');
    }

    try {
      const response = await axios.get(`${apiUrl}/v1/offerings`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data?.offerings || response.data || [];
    } catch (err) {
      console.error('[Exly Service Error] Failed to fetch offerings:', err.message);
      throw new Error(err.response?.data?.message || 'Failed to fetch offerings from Exly API.');
    }
  }

  async fetchBookings(since) {
    const { apiKey, apiUrl } = this.getCredentials();
    if (!apiKey) {
      throw new Error('Exly API key is not configured in .env settings.');
    }

    try {
      const params = {};
      if (since) params.since = since;

      const response = await axios.get(`${apiUrl}/v1/bookings`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        params
      });
      return response.data?.bookings || response.data || [];
    } catch (err) {
      console.error('[Exly Service Error] Failed to fetch bookings:', err.message);
      throw new Error(err.response?.data?.message || 'Failed to fetch bookings from Exly API.');
    }
  }

  /**
   * Synchronizes Exly offerings and bookings into the database.
   */
  async syncAll() {
    const offeringsRaw = await this.fetchOfferings();
    const bookingsRaw = await this.fetchBookings();

    // 1. Sync Offerings (Check-then-Write / Upsert)
    for (const off of offeringsRaw) {
      const rawTitle = off.title || off.name || '';
      const offId = off.id || off.offeringId || '';
      if (shouldIgnoreOffering(rawTitle, offId)) continue;

      const { cleanTitle, dateStr, timeStr } = parseOfferingTitle(rawTitle);
      const cleanOffId = offId || cleanTitle.toLowerCase().replace(/\s+/g, '-');

      await ExlyOffering.findOneAndUpdate(
        { offeringId: cleanOffId },
        {
          $set: {
            title: cleanTitle,
            eventDate: dateStr,
            eventTime: timeStr,
            type: off.type || 'program',
            price: isNaN(Number(off.price)) ? 0 : Number(off.price || 0),
            currency: off.currency || 'INR',
            status: off.status || 'active'
          }
        },
        { upsert: true, new: true }
      );
    }

    // 2. Sync Bookings/Leads into CRM
    const { assignLeadToRep } = require('../controllers/crmController');
    const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');
    
    let addedCount = 0;
    let updatedCount = 0;

    for (const b of bookingsRaw) {
      const rawTitle = b.offeringTitle || b.program || '';
      if (shouldIgnoreOffering(rawTitle, b.offeringId)) continue;

      const { cleanTitle } = parseOfferingTitle(rawTitle);

      const rawPhone = b.phone || b.customerPhone || '';
      const rawEmail = b.email || b.customerEmail || '';
      const phone = normalizePhone(rawPhone);
      const email = sanitizeEmail(rawEmail);

      if (!phone && !email) continue;

      const name = sanitizeName(b.name || b.customerName || 'Exly Lead');
      const offeringId = b.offeringId || cleanTitle.toLowerCase().replace(/\s+/g, '-');
      const txnId = b.transactionId || b.transactionIdExly || '';
      const custId = b.customerId || b.customerIdExly || '';
      const pricePaid = isNaN(Number(b.pricePaid)) ? 0 : Number(b.pricePaid || 0);
      const bookedOn = b.bookedOn ? new Date(b.bookedOn) : new Date();

      // Upsert ExlyBooking with secure query
      const bookingQuery = txnId 
        ? { transactionId: txnId }
        : {
            offeringId: offeringId,
            $or: [
              ...(email ? [{ email: email }] : []),
              ...(phone ? [{ phone: phone }] : [])
            ]
          };

      await ExlyBooking.findOneAndUpdate(
        bookingQuery,
        {
          $set: {
            customerId: custId,
            offeringId,
            offeringTitle: cleanTitle,
            name,
            email,
            phone,
            pricePaid,
            state: b.state || 'Selected',
            payoutStatus: b.payoutStatus || 'Processed',
            bookedOn,
            transactionId: txnId
          }
        },
        { upsert: true }
      );

      const filter = { $or: [] };
      if (phone) filter.$or.push({ phone });
      if (email) filter.$or.push({ email });

      if (filter.$or.length > 0) {
        let existing = await Lead.findOne(filter);
        if (existing) {
          existing.name = name || existing.name;
          existing.email = email || existing.email;
          existing.phone = phone || existing.phone;
          existing.customerIdExly = custId || existing.customerIdExly;
          existing.transactionIdExly = txnId || existing.transactionIdExly;
          existing.exlyOfferingId = offeringId || existing.exlyOfferingId;
          existing.exlyOfferingTitle = cleanTitle || existing.exlyOfferingTitle;
          await existing.save();
          updatedCount++;
        }
      }
    }

    // 3. Recalculate Offering analytics based on ExlyBookings and CRM Leads
    const allStoredOfferings = await ExlyOffering.find({});
    for (const offering of allStoredOfferings) {
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
    }

    return {
      offeringsSynced: offeringsRaw.length,
      leadsAdded: addedCount,
      leadsUpdated: updatedCount
    };
  }
}

module.exports = new ExlyService();
