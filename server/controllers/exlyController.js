const mongoose = require('mongoose');
const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const exlyService = require('../services/exlyService');
const CRMAudit = require('../models/CRMAudit');
const Lead = require('../models/Lead');
const LeadService = require('../services/LeadService');
const { assignLeadToRep } = require('./crmController');
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

// Helper to extract nested or flexible case-insensitive keys from a payload object
const getPayloadValue = (payload, possibleKeys) => {
  if (!payload || typeof payload !== 'object') return '';
  
  // 1. Try exact match
  for (const key of possibleKeys) {
    if (payload[key] !== undefined && payload[key] !== null) {
      const val = payload[key];
      if (typeof val === 'string') {
        const trimmed = val.trim();
        const lower = trimmed.toLowerCase();
        if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') {
          continue;
        }
        return trimmed;
      }
      return val;
    }
  }

  // 2. Try normalized case-insensitive & space/underscore-insensitive match
  const normalizedTargets = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const key of Object.keys(payload)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idx = normalizedTargets.indexOf(cleanKey);
    if (idx !== -1) {
      const val = payload[key];
      if (typeof val === 'string') {
        const trimmed = val.trim();
        const lower = trimmed.toLowerCase();
        if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') {
          continue;
        }
        return trimmed;
      }
      return val;
    }
  }

  return '';
};

exports.getOfferings = async (req, res) => {
  try {
    // Proactive Purge of ignored offerings from DB
    await ExlyOffering.deleteMany({
      $or: [
        { title: { $in: [/testing BR community/i, /Program Name/i, /testing/i, /demo community/i, /demo day- results/i] } },
        { offeringId: { $in: ['demo-community', 'demo-day--results'] } }
      ]
    });

    // Auto-migrate and clean existing offering titles, separating date and time
    const allOfferings = await ExlyOffering.find();
    for (const off of allOfferings) {
      if (shouldIgnoreOffering(off.title, off.offeringId)) {
        await ExlyOffering.deleteOne({ _id: off._id });
        continue;
      }
      if (off.title.includes('|')) {
        const { cleanTitle, dateStr, timeStr } = parseOfferingTitle(off.title);
        off.title = cleanTitle;
        off.eventDate = dateStr;
        off.eventTime = timeStr;
        await off.save();
      }
    }

    // Auto-migrate booking titles
    const allBookings = await ExlyBooking.find();
    for (const b of allBookings) {
      if (shouldIgnoreOffering(b.offeringTitle, b.offeringId)) {
        await ExlyBooking.deleteOne({ _id: b._id });
        continue;
      }
      if (b.offeringTitle && b.offeringTitle.includes('|')) {
        const { cleanTitle } = parseOfferingTitle(b.offeringTitle);
        b.offeringTitle = cleanTitle;
        await b.save();
      }
    }

    // Auto-migrate CRM Leads referencing offerings
    const allLeads = await Lead.find();
    for (const l of allLeads) {
      if (l.exlyOfferingTitle && l.exlyOfferingTitle.includes('|')) {
        const { cleanTitle } = parseOfferingTitle(l.exlyOfferingTitle);
        l.exlyOfferingTitle = cleanTitle;
        l.source = cleanTitle;
        await l.save();
      }
    }

    const offerings = await ExlyOffering.find({
      title: { $nin: [/testing BR community/i, /Program Name/i, /testing/i, /demo community/i, /demo day- results/i] },
      offeringId: { $nin: ['demo-community', 'demo-day--results'] }
    }).sort({ totalRevenue: -1 }).lean();

    res.json(offerings);
  } catch (err) {
    console.error('[Exly getOfferings Error]', err.message);
    res.status(500).json({ error: 'Failed to retrieve Exly offerings.' });
  }
};

exports.getConfigStatus = async (req, res) => {
  try {
    const { apiKey, apiUrl } = exlyService.getCredentials();
    res.json({
      connected: !!apiKey,
      apiUrl,
      apiKeyObfuscated: apiKey ? `${apiKey.substring(0, 4)}••••••••` : ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve Exly config status.' });
  }
};

exports.syncExlyData = async (req, res) => {
  try {
    const result = await exlyService.syncAll();
    
    // Audit Logging
    await CRMAudit.create({
      userId: req.user._id,
      userRole: req.user.role,
      action: 'EXLY_SYNC',
      fieldChanged: 'all',
      oldValue: 'un-synced',
      newValue: `offerings_${result.offeringsSynced}_added_${result.leadsAdded}_updated_${result.leadsUpdated}`,
      notes: `Manually triggered Exly integration sync: Synced ${result.offeringsSynced} offerings, added ${result.leadsAdded} new leads, updated ${result.leadsUpdated} existing leads.`
    });

    res.json({
      success: true,
      message: 'Exly synchronization completed successfully.',
      ...result
    });
  } catch (err) {
    console.error('[Exly Controller Sync Error]', err.message);
    res.status(400).json({ success: false, error: err.message || 'Sync failed.' });
  }
};

exports.handleExlyWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('⚡ [Exly Webhook] Payload received:', JSON.stringify(payload));

    const rawPhone = getPayloadValue(payload, ['phone', 'customerPhone', 'mobile', 'phoneMobile', 'phoneNumber', 'Phone Number', 'Phone/Mobile', 'Customer Phone Number', 'Customer Phone']);
    const rawEmail = getPayloadValue(payload, ['email', 'customerEmail', 'emailProfile', 'emailAddress', 'Email', 'Customer Email', 'Email Profile', 'Email Address']);
    const phone = normalizePhone(rawPhone);
    const email = sanitizeEmail(rawEmail);

    if (!phone && !email) {
      return res.status(400).json({ success: false, message: 'Invalid payload: phone or email required.' });
    }

    const rawOfferingTitle = getPayloadValue(payload, ['offeringTitle', 'offeringName', 'offering', 'Offering', 'Offering Name', 'Offering Title', 'offeringPurchased', 'Offering Purchased', 'program', 'programName', 'Program Name', 'Program']) || 'Exly Offering';
    const offeringId = getPayloadValue(payload, ['offeringId', 'offeringID', 'programId', 'programID', 'id', 'Offering Id', 'Offering ID', 'Program Id', 'Program ID']);

    // Ignore test/program name offerings
    if (shouldIgnoreOffering(rawOfferingTitle, offeringId)) {
      return res.status(200).json({ success: true, message: 'Webhook received but offering ignored (test offering).' });
    }

    const { cleanTitle, dateStr, timeStr } = parseOfferingTitle(rawOfferingTitle);

    const name = sanitizeName(getPayloadValue(payload, ['name', 'customerName', 'fullName', 'clientName', 'Name', 'Customer Name', 'Full Name', 'Client Name', 'customer_name']) || 'Exly Lead');
    const txnId = getPayloadValue(payload, ['transactionId', 'transactionID', 'Transaction Id', 'Transaction ID', 'transactionIdExly', 'txnId', 'txnID', 'transaction_id']);
    const custId = getPayloadValue(payload, ['customerId', 'customerID', 'Customer Id', 'Customer ID', 'customerIdExly', 'custId', 'custID', 'customer_id']);
    const priceRaw = getPayloadValue(payload, ['price', 'amount', 'pricePaid', 'Price Paid', 'Transaction Amount', 'transactionAmount', 'priceSettled', 'Price Settled']);
    const priceCleaned = typeof priceRaw === 'string' ? priceRaw.replace(/[₹\s,]/g, '').trim() : priceRaw;
    const price = isNaN(Number(priceCleaned)) ? 0 : Number(priceCleaned);

    const bookedOnRaw = getPayloadValue(payload, ['bookedOn', 'Booked On', 'bookingDate', 'Booking Date', 'date', 'Date', 'createdAt', 'Created At']);
    const bookedOnDate = bookedOnRaw ? new Date(bookedOnRaw) : new Date();

    const state = getPayloadValue(payload, ['state', 'State', 'payoutState', 'Payout State', 'region', 'Region']) || 'Selected';
    const payoutStatus = getPayloadValue(payload, ['payoutStatus', 'Payout Status', 'payoutState', 'Payout State']) || 'Processed';
    const offeringType = getPayloadValue(payload, ['offeringType', 'Offering Type', 'type', 'Type']) || 'program';
    const currency = getPayloadValue(payload, ['currency', 'Currency']) || 'INR';

    // 1. Sync or Create Exly Offering
    const offId = offeringId || cleanTitle.toLowerCase().replace(/\s+/g, '-');
    await ExlyOffering.findOneAndUpdate(
      { offeringId: offId },
      {
        $set: {
          title: cleanTitle,
          eventDate: dateStr,
          eventTime: timeStr,
          type: offeringType,
          price: price,
          currency: currency,
          status: 'active'
        }
      },
      { upsert: true, new: true }
    );

    // 2. Sync lead into CRM using transaction (race condition safe)
    let lead = null;
    const filterConditions = [];
    if (email) filterConditions.push({ email });
    if (phone) filterConditions.push({ phone });

    if (filterConditions.length > 0) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        let assignedRepId = null;
        
        // 1. Check for existing document inside the transaction session
        const existing = await Lead.findOne({ $or: filterConditions })
          .select('assignedRepId')
          .session(session);

        if (!existing) {
          // 2. Safely calculate least-loaded rep without race conditions
          assignedRepId = await assignLeadToRep(session);
        }

        const updatePayload = {
          customerIdExly: custId,
          transactionIdExly: txnId,
          exlyOfferingId: offId,
          exlyOfferingTitle: cleanTitle,
          $setOnInsert: {
            name: name || 'Exly Lead',
            source: cleanTitle || 'Exly Offering',
            leadStatus: 'Fresh',
            callStatus: 'Fresh',
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(assignedRepId ? { assignedRepId } : {})
          }
        };

        // 3. Execute upsert within the same transaction scope
        lead = await LeadService.upsertLead(
          { $or: filterConditions },
          updatePayload,
          session
        );

        await session.commitTransaction();
        if (lead) {
          await LeadService.triggerSideEffects(lead._id);
        }
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }




    // 3. Create/update individual ExlyBooking record with secure query
    const bookingQuery = txnId 
      ? { transactionId: txnId }
      : {
          offeringId: offId,
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
          offeringId: offId,
          offeringTitle: cleanTitle,
          name: name,
          email: email,
          phone: phone,
          pricePaid: price,
          state: state,
          payoutStatus: payoutStatus,
          bookedOn: bookedOnDate,
          transactionId: txnId
        }
      },
      { upsert: true }
    );

    // 4. Recalculate Offering analytics based on ExlyBookings and CRM Leads
    const offering = await ExlyOffering.findOne({ offeringId: offId });
    if (offering) {
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

    res.status(200).json({ success: true, message: 'Webhook processed, CRM hydrated.', leadId: lead ? lead._id : null });
  } catch (err) {
    console.error('❌ [Exly Webhook Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOfferingDetails = async (req, res) => {
  try {
    const { offeringId } = req.params;
    
    const offering = await ExlyOffering.findOne({ offeringId }).lean();
    if (!offering) {
      return res.status(404).json({ error: 'Offering not found.' });
    }

    const bookings = await ExlyBooking.find({ offeringId }).sort({ bookedOn: -1 }).lean();

    if (bookings.length === 0) {
      return res.json({
        offering,
        bookings: []
      });
    }

    const uniqueEmails = bookings.map(b => b.email).filter(Boolean);
    const uniquePhones = bookings.map(b => b.phone).filter(Boolean);

    // Fetch CRM Lead status for each booking safely
    let crmLeads = [];
    if (uniqueEmails.length > 0 || uniquePhones.length > 0) {
      const orFilters = [];
      if (uniqueEmails.length > 0) orFilters.push({ email: { $in: uniqueEmails } });
      if (uniquePhones.length > 0) orFilters.push({ phone: { $in: uniquePhones } });

      crmLeads = await Lead.find({ $or: orFilters })
        .select('email phone leadStatus callStatus assignedRepId')
        .populate('assignedRepId', 'name')
        .lean();
    }

    const bookingsWithCrm = bookings.map(b => {
      const matched = crmLeads.find(l => 
        (b.email && l.email?.toLowerCase() === b.email.toLowerCase()) ||
        (b.phone && l.phone === b.phone)
      );
      return {
        ...b,
        inCRM: !!matched,
        crmStatus: matched ? matched.leadStatus : 'Unlinked',
        crmCallStatus: matched ? matched.callStatus : 'Unlinked',
        crmRep: matched?.assignedRepId?.name || 'Unassigned'
      };
    });

    res.json({
      offering,
      bookings: bookingsWithCrm
    });

  } catch (err) {
    console.error('[Exly getOfferingDetails Error]', err.message);
    res.status(500).json({ error: 'Failed to retrieve offering details.' });
  }
};

exports.getOfferingAnalytics = async (req, res) => {
  try {
    const { offeringId } = req.params;

    const bookings = await ExlyBooking.find({ offeringId }).lean();
    if (bookings.length === 0) {
      return res.json({
        analytics: {
          totalCustomers: 0,
          newCustomers: 0,
          upsells: 0,
          loyalCustomers: 0,
          lifetimeValue: 0,
          avgLTV: 0
        },
        chartData: []
      });
    }

    const uniqueEmails = bookings.map(b => b.email).filter(Boolean);
    const uniquePhones = bookings.map(b => b.phone).filter(Boolean);

    // Fetch complete history of these customers to compute metrics
    const allHistories = await ExlyBooking.find({
      $or: [
        { email: { $in: uniqueEmails } },
        { phone: { $in: uniquePhones } }
      ]
    }).sort({ bookedOn: 1 }).lean();

    // Group bookings by customer key (email or phone)
    const customerMap = new Map();
    bookings.forEach(b => {
      const key = b.email || b.phone;
      if (!customerMap.has(key)) {
        customerMap.set(key, b);
      }
    });

    const uniqueCustomers = Array.from(customerMap.keys());
    let newCustomersCount = 0;
    let upsellsCount = 0;
    let loyalCustomersCount = 0;
    let totalLTV = 0;

    uniqueCustomers.forEach(cKey => {
      const cBooking = customerMap.get(cKey);
      const email = cBooking.email;
      const phone = cBooking.phone;

      const history = allHistories.filter(h => 
        (email && h.email === email) || (phone && h.phone === phone)
      );

      const firstThisBooking = history.find(h => h.offeringId === offeringId);
      const firstThisDate = firstThisBooking ? firstThisBooking.bookedOn : null;

      const isNew = history[0] && history[0].offeringId === offeringId;
      if (isNew) newCustomersCount++;

      const isUpsell = history.some(h => h.offeringId !== offeringId && h.bookedOn < firstThisDate);
      if (isUpsell) upsellsCount++;

      const isLoyal = history.length >= 2;
      if (isLoyal) loyalCustomersCount++;

      const ltv = history.reduce((sum, h) => sum + h.pricePaid, 0);
      totalLTV += ltv;
    });

    // Time-series chart data for this offering specifically
    const dailyMap = new Map();
    bookings.forEach(b => {
      if (!b.bookedOn) return;
      let dStr = '';
      try {
        const d = new Date(b.bookedOn);
        if (!isNaN(d.getTime())) {
          dStr = d.toISOString().split('T')[0];
        }
      } catch (e) {}
      if (!dStr) return;

      if (!dailyMap.has(dStr)) {
        dailyMap.set(dStr, { date: dStr, revenue: 0, bookings: 0 });
      }
      const dayData = dailyMap.get(dStr);
      dayData.revenue += b.pricePaid || 0;
      dayData.bookings += 1;
    });

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      analytics: {
        totalCustomers: uniqueCustomers.length,
        newCustomers: newCustomersCount,
        upsells: upsellsCount,
        loyalCustomers: loyalCustomersCount,
        lifetimeValue: totalLTV,
        avgLTV: uniqueCustomers.length > 0 ? Number((totalLTV / uniqueCustomers.length).toFixed(1)) : 0
      },
      chartData
    });
  } catch (err) {
    console.error('[Exly getOfferingAnalytics Error]', err.message);
    res.status(500).json({ error: 'Failed to compute offering analytics.' });
  }
};

exports.updateOffering = async (req, res) => {
  try {
    const { offeringId } = req.params;
    const { title, type, status, price, eventDate, eventTime } = req.body;

    const offering = await ExlyOffering.findOne({ offeringId });
    if (!offering) {
      return res.status(404).json({ error: 'Offering not found.' });
    }

    if (title !== undefined) offering.title = title;
    if (type !== undefined) offering.type = type;
    if (status !== undefined) offering.status = status;
    if (price !== undefined) offering.price = Number(price) || 0;
    if (eventDate !== undefined) offering.eventDate = eventDate;
    if (eventTime !== undefined) offering.eventTime = eventTime;

    await offering.save();

    await CRMAudit.create({
      userId: req.user._id,
      userRole: req.user.role,
      action: 'EXLY_OFFERING_UPDATE',
      fieldChanged: 'multiple',
      oldValue: 'previous_values',
      newValue: JSON.stringify({ title, type, status, price, eventDate, eventTime }),
      notes: `Updated Exly offering: ${offeringId}`
    });

    res.json({ success: true, offering });
  } catch (err) {
    console.error('[Exly updateOffering Error]', err.message);
    res.status(500).json({ error: 'Failed to update Exly offering.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const bookings = await ExlyBooking.find().sort({ bookedOn: 1 }).lean();

    const dailyMap = new Map();
    const uniqueKeys = new Set();

    bookings.forEach(b => {
      if (!b.bookedOn) return;
      const dateStr = new Date(b.bookedOn).toISOString().split('T')[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { date: dateStr, revenue: 0, bookings: 0 });
      }
      const dayData = dailyMap.get(dateStr);
      dayData.revenue += b.pricePaid || 0;
      dayData.bookings += 1;

      // Unique identifier for client across all offerings
      const key = `${b.email?.toLowerCase().trim() || ''}-${b.phone?.trim() || ''}`;
      uniqueKeys.add(key);
    });

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Get the absolute most recent booking
    const recentBooking = await ExlyBooking.findOne().sort({ bookedOn: -1 }).lean();

    res.json({
      chartData,
      recentBooking,
      uniqueBookingsCount: uniqueKeys.size,
      totalBookingsCount: bookings.length
    });
  } catch (err) {
    console.error('[Exly getDashboardStats Error]', err.message);
    res.status(500).json({ error: 'Failed to compute dashboard statistics.' });
  }
};

exports.getUnlinkedBookings = async (req, res) => {
  try {
    const bookings = await ExlyBooking.find().sort({ bookedOn: -1 }).lean();
    const leads = await Lead.find({}, 'email phone').lean();
    
    const leadEmails = new Set(leads.map(l => l.email?.toLowerCase().trim()).filter(Boolean));
    const leadPhones = new Set(leads.map(l => l.phone?.trim()).filter(Boolean));

    const unlinked = bookings.filter(b => {
      const emailMatch = b.email ? leadEmails.has(b.email.toLowerCase().trim()) : false;
      const phoneMatch = b.phone ? leadPhones.has(b.phone.trim()) : false;
      return !emailMatch && !phoneMatch;
    });

    res.json(unlinked);
  } catch (err) {
    console.error('[Exly getUnlinkedBookings Error]', err.message);
    res.status(500).json({ error: 'Failed to retrieve unlinked bookings.' });
  }
};

exports.linkUnlinkedBookings = async (req, res) => {
  try {
    const { bookingIds } = req.body;
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: 'No booking IDs provided.' });
    }

    // 1. Create manual backup
    const csvBackupService = require('../services/csvBackupService');
    const backupFile = await csvBackupService.createManualBackup();

    // 2. Fetch bookings
    const bookings = await ExlyBooking.find({ _id: { $in: bookingIds } }).lean();
    if (bookings.length === 0) {
      return res.status(400).json({ error: 'No matching bookings found.' });
    }

    let addedCount = 0;
    for (const booking of bookings) {
      const filterConditions = [];
      if (booking.phone) filterConditions.push({ phone: booking.phone });
      if (booking.email) filterConditions.push({ email: booking.email });

      let existing = null;
      if (filterConditions.length > 0) {
        existing = await Lead.findOne({ $or: filterConditions });
      }

      if (!existing) {
        const assignedRepId = await assignLeadToRep();
        
        await Lead.create({
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          source: booking.offeringTitle,
          exlyOfferingId: booking.offeringId,
          exlyOfferingTitle: booking.offeringTitle,
          customerIdExly: booking.customerId,
          transactionIdExly: booking.transactionId,
          leadStatus: 'Fresh',
          callStatus: 'Fresh',
          assignedRepId
        });
        addedCount++;
      } else {
        existing.customerIdExly = booking.customerId || existing.customerIdExly;
        existing.transactionIdExly = booking.transactionId || existing.transactionIdExly;
        existing.exlyOfferingId = booking.offeringId || existing.exlyOfferingId;
        existing.exlyOfferingTitle = booking.offeringTitle || existing.exlyOfferingTitle;
        await existing.save();
      }
    }

    // 3. Queue CRM CSV backup
    const { queueCsvBackup } = require('../services/backgroundQueue');
    queueCsvBackup();

    res.json({
      success: true,
      message: `Successfully linked bookings. Added ${addedCount} new leads to CRM.`,
      backupFile
    });
  } catch (err) {
    console.error('[Exly linkUnlinkedBookings Error]', err.message);
    res.status(500).json({ error: err.message || 'Failed to link bookings.' });
  }
};

