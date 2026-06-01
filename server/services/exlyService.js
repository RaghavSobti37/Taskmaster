const axios = require('axios');
const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');

const { parseOfferingTitle, shouldIgnoreOffering } = require('../utils/exlyUtils');
const { recalculateOfferingMetrics } = require('./exlyOfferingMetrics');

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
        // Stop automatically adding to Leads table as requested by the user.
        // Instead, we only aggregate data into the Unified Contact hub.
        const ContactService = require('./ContactService');
        const booking = await ExlyBooking.findOne(filter).select('_id').lean();
        await ContactService.mergeContact({
          name: name || 'Exly Lead',
          email: email,
          phone: phone,
          exlyOfferingTitle: cleanTitle,
          recordId: booking?._id,
          inletKey: /community/i.test(cleanTitle) ? 'community' : 'exly',
          summary: { offeringTitle: cleanTitle, pricePaid },
        }, /community/i.test(cleanTitle) ? 'community' : 'exly');
        
        updatedCount++; // Track successfully processed contacts
      }
    }

    // 3. Recalculate Offering analytics based on ExlyBookings and CRM Leads
    const allStoredOfferings = await ExlyOffering.find({});
    for (const offering of allStoredOfferings) {
      await recalculateOfferingMetrics(offering);
    }

    return {
      offeringsSynced: offeringsRaw.length,
      leadsAdded: addedCount,
      leadsUpdated: updatedCount
    };
  }
}

module.exports = new ExlyService();
