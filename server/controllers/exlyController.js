const ExlyOffering = require('../models/ExlyOffering');
const exlyService = require('../services/exlyService');
const CRMAudit = require('../models/CRMAudit');
const Lead = require('../models/Lead');
const { assignLeadToRep } = require('./crmController');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');

exports.getOfferings = async (req, res) => {
  try {
    const offerings = await ExlyOffering.find().sort({ title: 1 }).lean();
    res.json(offerings);
  } catch (err) {
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

    const rawPhone = payload.phone || payload.customerPhone || payload.mobile || '';
    const rawEmail = payload.email || payload.customerEmail || '';
    const phone = normalizePhone(rawPhone);
    const email = sanitizeEmail(rawEmail);

    if (!phone && !email) {
      return res.status(400).json({ success: false, message: 'Invalid payload: phone or email required.' });
    }

    const name = sanitizeName(payload.name || payload.customerName || payload.fullName || 'Exly Lead');
    const offeringId = payload.offeringId || payload.programId || '';
    const offeringTitle = payload.offeringTitle || payload.programName || payload.program || 'Exly Offering';
    const txnId = payload.transactionId || payload.transactionIdExly || '';
    const custId = payload.customerId || payload.customerIdExly || '';
    const priceRaw = payload.price || payload.amount || 0;
    const price = isNaN(Number(priceRaw)) ? 0 : Number(priceRaw);

    // 1. Sync or Create Exly Offering
    if (offeringTitle) {
      const offId = offeringId || offeringTitle.toLowerCase().replace(/\s+/g, '-');
      await ExlyOffering.findOneAndUpdate(
        { offeringId: offId },
        {
          $set: {
            title: offeringTitle,
            type: payload.offeringType || payload.type || 'program',
            price: price,
            currency: payload.currency || 'INR',
            status: 'active'
          }
        },
        { upsert: true, new: true }
      );
    }

    // 2. Sync lead into CRM (Check-then-write / Upsert)
    const filter = { $or: [] };
    if (phone) filter.$or.push({ phone });
    if (email) filter.$or.push({ email });

    let lead = await Lead.findOne(filter);
    if (lead) {
      let assignedRepId = lead.assignedRepId;
      if (!assignedRepId) {
        assignedRepId = await assignLeadToRep();
      }
      lead.name = name || lead.name;
      lead.assignedRepId = assignedRepId;
      lead.customerIdExly = custId || lead.customerIdExly;
      lead.transactionIdExly = txnId || lead.transactionIdExly;
      lead.exlyOfferingId = offeringId || lead.exlyOfferingId;
      lead.exlyOfferingTitle = offeringTitle || lead.exlyOfferingTitle;
      lead.source = offeringTitle || lead.source || 'Exly';
      await lead.save();
    } else {
      const assignedRepId = await assignLeadToRep();
      lead = await Lead.create({
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
    }

    // 3. Recalculate Offering analytics based on CRM Leads
    if (offeringTitle) {
      const offId = offeringId || offeringTitle.toLowerCase().replace(/\s+/g, '-');
      const offering = await ExlyOffering.findOne({ offeringId: offId });
      if (offering) {
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
    }

    res.status(200).json({ success: true, message: 'Webhook processed, CRM hydrated.', leadId: lead._id });
  } catch (err) {
    console.error('❌ [Exly Webhook Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
