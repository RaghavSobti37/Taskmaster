const mongoose = require('mongoose');
const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const exlyService = require('../services/exlyService');
const CRMAudit = require('../models/CRMAudit');
const Lead = require('../models/Lead');
const LeadService = require('../services/LeadService');
const { assignLeadToRep } = require('./crmController');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');
const logger = require('../utils/logger');
const { rejectUnlessWebhookSignature } = require('../utils/webhookAuth');
const { getDepartmentSlug } = require('../utils/departmentPermissions');

const { parseOfferingTitle, shouldIgnoreOffering } = require('../utils/exlyUtils');
const {
  computeBookingBreakdown,
  buildDailyChartData,
  getCustomerKey,
  isPaidBooking,
  roundMoney
} = require('../utils/exlyMetrics');
const { recalculateOfferingMetrics } = require('../services/exlyOfferingMetrics');
const { getCache, setCache } = require('../services/cacheService');
const {
  scheduleExlyOfferingMigrationIfNeeded,
  IGNORED_TITLE_PATTERNS,
  IGNORED_OFFERING_IDS,
} = require('../services/exlyOfferingMigration');

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
    scheduleExlyOfferingMigrationIfNeeded();

    const cacheKey = 'exly:offerings:list';
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const offerings = await ExlyOffering.find({
      title: { $nin: IGNORED_TITLE_PATTERNS },
      offeringId: { $nin: IGNORED_OFFERING_IDS },
    }).sort({ totalRevenue: -1 }).lean();

    const bookingStats = await ExlyBooking.aggregate([
      {
        $group: {
          _id: '$offeringId',
          totalBookings: { $sum: 1 },
          paidBookings: {
            $sum: { $cond: [{ $gt: [{ $ifNull: ['$pricePaid', 0] }, 0] }, 1, 0] }
          },
          freeBookings: {
            $sum: { $cond: [{ $lte: [{ $ifNull: ['$pricePaid', 0] }, 0] }, 1, 0] }
          },
          totalRevenue: { $sum: { $ifNull: ['$pricePaid', 0] } }
        }
      }
    ]);

    const statsMap = new Map(
      bookingStats.map((row) => [
        row._id,
        {
          totalBookings: row.totalBookings,
          paidBookings: row.paidBookings,
          freeBookings: row.freeBookings,
          totalRevenue: roundMoney(row.totalRevenue),
          avgOrderValue: row.paidBookings > 0 ? roundMoney(row.totalRevenue / row.paidBookings) : 0
        }
      ])
    );

    const enrichedOfferings = offerings.map((offering) => {
      const stats = statsMap.get(offering.offeringId);
      if (!stats) return offering;
      return { ...offering, ...stats };
    });

    await setCache(cacheKey, enrichedOfferings, 120);
    res.json(enrichedOfferings);
  } catch (err) {
    logger.error('Exly', 'getOfferings error', { error: err.message });
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
      userRole: getDepartmentSlug(req.user),
      action: 'EXLY_SYNC',
      fieldChanged: 'all',
      oldValue: 'un-synced',
      newValue: ['offerings', result.offeringsSynced, 'added', result.leadsAdded, 'updated', result.leadsUpdated].join('_'),
      notes: 'Manually triggered Exly integration sync: Synced ' + result.offeringsSynced + ' offerings, added ' + result.leadsAdded + ' new leads, updated ' + result.leadsUpdated + ' existing leads.'
    });

    res.json({
      success: true,
      message: 'Exly synchronization completed successfully.',
      ...result
    });
  } catch (err) {
    logger.error('Exly', 'Sync error', { error: err.message });
    res.status(400).json({ success: false, error: err.message || 'Sync failed.' });
  }
};

exports.handleExlyWebhook = async (req, res) => {
  if (!rejectUnlessWebhookSignature(req, res, 'EXLY_WEBHOOK_SECRET')) {
    return;
  }

  try {
    const payload = req.body;
    logger.info('Exly Webhook', 'Payload received', { payload });

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

    // 2. Sync lead into Unified Contact Hub (race condition safe via mergeContact)
    const ContactService = require('../services/ContactService');
    let contact = null;
    
    if (email || phone) {
      contact = await ContactService.mergeContact({
        name: name || 'Exly Lead',
        email: email,
        phone: phone,
        exlyOfferingTitle: cleanTitle,
        inletKey: /community/i.test(cleanTitle) ? 'community' : 'exly',
        summary: { offeringTitle: cleanTitle, price },
      }, /community/i.test(cleanTitle) ? 'community' : 'exly');
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
      await recalculateOfferingMetrics(offering);
    }

    res.status(200).json({ success: true, message: 'Webhook processed, CRM hydrated.', contactId: contact ? contact._id : null });
  } catch (err) {
    logger.error('Exly Webhook', 'Processing error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOfferingDetails = async (req, res) => {
  try {
    const { offeringId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const paymentFilter = ['all', 'paid', 'free'].includes(req.query.paymentFilter)
      ? req.query.paymentFilter
      : 'all';
    const search = (req.query.search || '').trim().toLowerCase();

    const offering = await ExlyOffering.findOne({ offeringId }).lean();
    if (!offering) {
      return res.status(404).json({ error: 'Offering not found.' });
    }

    const allBookings = await ExlyBooking.find({ offeringId }).sort({ bookedOn: -1 }).lean();
    const metrics = computeBookingBreakdown(allBookings);

    let filteredBookings = allBookings;
    if (paymentFilter === 'paid') {
      filteredBookings = allBookings.filter(isPaidBooking);
    } else if (paymentFilter === 'free') {
      filteredBookings = allBookings.filter((booking) => !isPaidBooking(booking));
    }

    if (search) {
      filteredBookings = filteredBookings.filter((booking) =>
        booking.name?.toLowerCase().includes(search) ||
        booking.email?.toLowerCase().includes(search) ||
        booking.phone?.includes(search)
      );
    }

    const totalFiltered = filteredBookings.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
    const safePage = Math.min(page, totalPages);
    const paginatedBookings = filteredBookings.slice((safePage - 1) * limit, safePage * limit);

    if (paginatedBookings.length === 0) {
      return res.json({
        offering,
        metrics: {
          ...metrics,
          conversionRate: offering.conversionRate || 0
        },
        bookings: [],
        pagination: {
          page: safePage,
          limit,
          total: totalFiltered,
          totalPages,
          paymentFilter
        }
      });
    }

    const uniqueEmails = paginatedBookings.map((b) => b.email).filter(Boolean);
    const uniquePhones = paginatedBookings.map((b) => b.phone).filter(Boolean);

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

    const bookingsWithCrm = paginatedBookings.map((b) => {
      const matched = crmLeads.find((l) =>
        (b.email && l.email?.toLowerCase() === b.email.toLowerCase()) ||
        (b.phone && l.phone === b.phone)
      );
      return {
        ...b,
        inCRM: !!matched,
        crmStatus: matched ? matched.leadStatus : 'Unlinked',
        crmCallStatus: matched ? matched.callStatus : 'Unlinked',
        crmRep: matched?.assignedRepId?.name || 'Unassigned',
        isPaid: isPaidBooking(b)
      };
    });

    res.json({
      offering,
      metrics: {
        ...metrics,
        conversionRate: offering.conversionRate || 0
      },
      bookings: bookingsWithCrm,
      pagination: {
        page: safePage,
        limit,
        total: totalFiltered,
        totalPages,
        paymentFilter
      }
    });
  } catch (err) {
    logger.error('Exly', 'getOfferingDetails error', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve offering details.' });
  }
};

exports.getOfferingAnalytics = async (req, res) => {
  try {
    const { offeringId } = req.params;

    const bookings = await ExlyBooking.find({ offeringId }).lean();
    const breakdown = computeBookingBreakdown(bookings);

    if (bookings.length === 0) {
      return res.json({
        analytics: {
          totalCustomers: 0,
          newCustomers: 0,
          upsells: 0,
          loyalCustomers: 0,
          lifetimeValue: 0,
          avgLTV: 0,
          paidBookings: 0,
          freeBookings: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          avgOrderValue: 0,
          conversionRate: 0
        },
        chartData: []
      });
    }

    const offering = await ExlyOffering.findOne({ offeringId }).lean();

    const uniqueEmails = bookings.map((b) => b.email).filter(Boolean);
    const uniquePhones = bookings.map((b) => b.phone).filter(Boolean);

    const allHistories = await ExlyBooking.find({
      $or: [
        { email: { $in: uniqueEmails } },
        { phone: { $in: uniquePhones } }
      ]
    }).sort({ bookedOn: 1 }).lean();

    const customerMap = new Map();
    bookings.forEach((b) => {
      const key = getCustomerKey(b);
      if (!customerMap.has(key)) {
        customerMap.set(key, b);
      }
    });

    const uniqueCustomers = Array.from(customerMap.keys());
    let newCustomersCount = 0;
    let upsellsCount = 0;
    let loyalCustomersCount = 0;
    let totalLTV = 0;
    let paidCustomerCount = 0;
    let freeCustomerCount = 0;

    uniqueCustomers.forEach((cKey) => {
      const cBooking = customerMap.get(cKey);
      const email = cBooking.email;
      const phone = cBooking.phone;

      const history = allHistories.filter((h) =>
        (email && h.email === email) || (phone && h.phone === phone)
      );

      const firstThisBooking = history.find((h) => h.offeringId === offeringId);
      const firstThisDate = firstThisBooking ? firstThisBooking.bookedOn : null;

      const isNew = history[0] && history[0].offeringId === offeringId;
      if (isNew) newCustomersCount++;

      const isUpsell = history.some((h) => h.offeringId !== offeringId && h.bookedOn < firstThisDate);
      if (isUpsell) upsellsCount++;

      const isLoyal = history.length >= 2;
      if (isLoyal) loyalCustomersCount++;

      const ltv = history.reduce((sum, h) => sum + (Number(h.pricePaid) || 0), 0);
      totalLTV += ltv;

      const paidForOffering = history.some((h) => h.offeringId === offeringId && isPaidBooking(h));
      if (paidForOffering) {
        paidCustomerCount += 1;
      } else {
        freeCustomerCount += 1;
      }
    });

    const chartData = buildDailyChartData(bookings);

    res.json({
      analytics: {
        totalCustomers: uniqueCustomers.length,
        newCustomers: newCustomersCount,
        upsells: upsellsCount,
        loyalCustomers: loyalCustomersCount,
        lifetimeValue: roundMoney(totalLTV),
        avgLTV: uniqueCustomers.length > 0 ? roundMoney(totalLTV / uniqueCustomers.length) : 0,
        paidBookings: breakdown.paidBookings,
        freeBookings: breakdown.freeBookings,
        totalRevenue: breakdown.totalRevenue,
        paidRevenue: breakdown.paidRevenue,
        avgOrderValue: breakdown.avgOrderValue,
        paidCustomers: paidCustomerCount,
        freeCustomers: freeCustomerCount,
        conversionRate: offering?.conversionRate || 0
      },
      chartData
    });
  } catch (err) {
    logger.error('Exly', 'getOfferingAnalytics error', { error: err.message });
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
      userRole: getDepartmentSlug(req.user),
      action: 'EXLY_OFFERING_UPDATE',
      fieldChanged: 'multiple',
      oldValue: 'previous_values',
      newValue: JSON.stringify({ title, type, status, price, eventDate, eventTime }),
      notes: `Updated Exly offering: ${offeringId}`
    });

    res.json({ success: true, offering });
  } catch (err) {
    logger.error('Exly', 'updateOffering error', { error: err.message });
    res.status(500).json({ error: 'Failed to update Exly offering.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const bookings = await ExlyBooking.find().sort({ bookedOn: 1 }).lean();
    const breakdown = computeBookingBreakdown(bookings);
    const chartData = buildDailyChartData(bookings);

    const uniqueKeys = new Set();
    bookings.forEach((b) => uniqueKeys.add(getCustomerKey(b)));

    const offerings = await ExlyOffering.find({}, 'conversionRate totalBookings').lean();
    const weightedConversion = offerings.reduce((sum, off) => sum + (off.conversionRate || 0), 0);
    const avgConversionRate = offerings.length > 0
      ? Number((weightedConversion / offerings.length).toFixed(1))
      : 0;

    const recentBooking = await ExlyBooking.findOne().sort({ bookedOn: -1 }).lean();

    res.json({
      chartData,
      recentBooking,
      uniqueBookingsCount: uniqueKeys.size,
      totalBookingsCount: breakdown.totalBookings,
      paidBookingsCount: breakdown.paidBookings,
      freeBookingsCount: breakdown.freeBookings,
      totalRevenue: breakdown.totalRevenue,
      paidRevenue: breakdown.paidRevenue,
      avgOrderValue: breakdown.avgOrderValue,
      avgConversionRate
    });
  } catch (err) {
    logger.error('Exly', 'getDashboardStats error', { error: err.message });
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
    logger.error('Exly', 'getUnlinkedBookings error', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve unlinked bookings.' });
  }
};

exports.linkUnlinkedBookings = async (req, res) => {
  try {
    const { bookingIds } = req.body;
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: 'No booking IDs provided.' });
    }

    // 1. Create automatic backup
    const csvBackupService = require('../services/csvBackupService');
    csvBackupService.backupAllLeadsToCsv();

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
      message: `Successfully linked bookings. Added ${addedCount} new leads to CRM.`
    });
  } catch (err) {
    logger.error('Exly', 'linkUnlinkedBookings error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to link bookings.' });
  }
};

