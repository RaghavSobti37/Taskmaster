const axios = require('axios');
const Lead = require('../models/Lead');
const ExlyOffering = require('../models/ExlyOffering');

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
    const offerings = await this.fetchOfferings();
    const bookings = await this.fetchBookings();

    // 1. Sync Offerings (Check-then-Write / Upsert)
    for (const off of offerings) {
      await ExlyOffering.findOneAndUpdate(
        { offeringId: off.id || off.offeringId },
        {
          $set: {
            title: off.title || off.name,
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

    for (const b of bookings) {
      const rawPhone = b.phone || b.customerPhone || '';
      const rawEmail = b.email || b.customerEmail || '';
      const phone = normalizePhone(rawPhone);
      const email = sanitizeEmail(rawEmail);

      if (!phone && !email) continue;

      const name = sanitizeName(b.name || b.customerName || 'Exly Lead');
      const offeringId = b.offeringId || '';
      const offeringTitle = b.offeringTitle || b.program || '';
      const txnId = b.transactionId || b.transactionIdExly || '';
      const custId = b.customerId || b.customerIdExly || '';

      const filter = { $or: [] };
      if (phone) filter.$or.push({ phone });
      if (email) filter.$or.push({ email });

      const existing = await Lead.findOne(filter);

      if (existing) {
        let assignedRepId = existing.assignedRepId;
        if (!assignedRepId) {
          assignedRepId = await assignLeadToRep();
        }
        existing.assignedRepId = assignedRepId;
        existing.customerIdExly = custId || existing.customerIdExly;
        existing.transactionIdExly = txnId || existing.transactionIdExly;
        existing.exlyOfferingId = offeringId || existing.exlyOfferingId;
        existing.exlyOfferingTitle = offeringTitle || existing.exlyOfferingTitle;
        existing.source = offeringTitle || existing.source || 'Exly';
        await existing.save();
        updatedCount++;
      } else {
        const assignedRepId = await assignLeadToRep();
        await Lead.create({
          name,
          email,
          phone: phone || '0000000000',
          customerIdExly: custId,
          transactionIdExly: txnId,
          exlyOfferingId: offeringId,
          exlyOfferingTitle: offeringTitle,
          source: offeringTitle || 'Exly',
          leadStatus: 'Warm',
          callStatus: 'Pending',
          assignedRepId
        });
        addedCount++;
      }
    }

    // 3. Recalculate Offering analytics based on CRM Leads
    const allStoredOfferings = await ExlyOffering.find({});
    for (const offering of allStoredOfferings) {
      const leadsForOffering = await Lead.find({
        $or: [
          { exlyOfferingId: offering.offeringId },
          { exlyOfferingTitle: offering.title },
          { source: offering.title }
        ]
      }).lean();

      const totalBookings = leadsForOffering.length;
      const convertedBookings = leadsForOffering.filter(l => l.leadStatus === 'Converted').length;
      const totalRevenue = totalBookings * offering.price;
      const conversionRate = totalBookings > 0 ? Number(((convertedBookings / totalBookings) * 100).toFixed(1)) : 0;

      offering.totalBookings = totalBookings;
      offering.totalRevenue = totalRevenue;
      offering.conversionRate = conversionRate;
      await offering.save();
    }

    return {
      offeringsSynced: offerings.length,
      leadsAdded: addedCount,
      leadsUpdated: updatedCount
    };
  }
}

module.exports = new ExlyService();
