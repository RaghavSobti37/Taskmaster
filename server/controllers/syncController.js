const holySheet = require('../utils/holySheet');
const Lead = require('../models/Lead');
const User = require('../models/User');
const CRMAudit = require('../models/CRMAudit');
const { assignLeadToRep } = require('./crmController');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');
const logger = require('../utils/logger');

/**
  * Sync Call Bookings from HolySheet BookedCalls sheet
  */
exports.syncBookings = async (req, res) => {
  try {
    const sheetName = req.query.sheet || 'BookedCalls';
    const apiKey = process.env.HOLYSHEET_BOOKED_CALLS_API_KEY || '';
    
    let rows = [];
    try {
      rows = await holySheet.getRowsCustomKey(sheetName, apiKey);
    } catch (err) {
      logger.warn('HolySheet Sync', err.message);
      // Return success with empty results if any HolySheet error occurs (e.g. unlinked sheet)
      return res.json({
        success: true,
        message: 'Sync complete.',
        addedCount: 0,
        updatedCount: 0,
        duplicateCount: 0
      });
    }
    
    let addedCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;

    for (const row of rows) {
      const rawPhone = row.phone || row.Phone || row['Mobile Number'] || row['Phone Number'] || '';
      const rawEmail = row.email || row.Email || row['Email Address'] || '';

      const phone = normalizePhone(rawPhone);
      const email = sanitizeEmail(rawEmail);

      if (!phone && !email) continue;

      const name = sanitizeName(row.name || row.Name || row['Full Name'] || row.full_name || 'Booked Discovery Lead');
      
      const rawDate = row.date || row.Date || row.booking_date || row.bookingDate || row.event_date || row.call_date || '';
      const date = rawDate.trim() ? new Date(rawDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      const rawTime = row.time || row.Time || row.booking_time || row.bookingTime || row.event_time || row.call_time || '';
      const time = rawTime.trim() ? rawTime.trim() : '14:00';

      const source = row.source || row.Source || 'Booked Call';
      const remarks = row.remarks || row.Remarks || row.notes || row.Notes || `Booked a discovery call for ${date} at ${time}.`;

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
        existing.nextFollowupDate = date;
        existing.nextFollowupTime = time;
        existing.callStatus = 'Scheduled';
        existing.leadStatus = 'Warm';
        existing.remarks = `${existing.remarks ? existing.remarks + ' • ' : ''}${remarks}`;
        await existing.save();

        updatedCount = updatedCount + 1;
      } else {
        const assignedRepId = await assignLeadToRep();

        await Lead.create({
          name,
          email,
          phone: phone || '0000000000',
          city: row.city || row.City || row.location || row.Location || '',
          leadStatus: 'Warm',
          callStatus: 'Scheduled',
          nextFollowupDate: date,
          nextFollowupTime: time,
          source,
          remarks,
          assignedRepId
        });

        addedCount++;
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      await CRMAudit.create({
        userId: req.user._id,
        userRole: req.user.role,
        action: 'BOOKING_SYNC',
        fieldChanged: 'leads',
        oldValue: 'holysheet_booked_calls',
        newValue: ['added', addedCount, 'updated', updatedCount].join('_'),
        notes: 'Ingested ' + addedCount + ' new bookings and updated ' + updatedCount + ' existing leads with scheduled followups.'
      });
    }

    res.json({
      success: true,
      message: `Successfully synchronized booked calls. ${addedCount} new leads created, ${updatedCount} existing leads updated with follow-up appointments.`,
      addedCount,
      updatedCount,
      duplicateCount
    });

  } catch (error) {
    logger.error('Sync', error.message);
    res.status(500).json({ success: false, error: error.message || 'Sync failed' });
  }
};
