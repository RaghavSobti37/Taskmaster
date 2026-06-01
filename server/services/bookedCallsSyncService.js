const holySheet = require('../utils/holySheet');
const Lead = require('../models/Lead');
const CRMAudit = require('../models/CRMAudit');
const LeadService = require('./LeadService');
const { assignLeadToRep } = require('../controllers/crmController');
const { normalizePhone, sanitizeEmail, sanitizeName } = require('../utils/sanitizer');
const logger = require('../utils/logger');

/**
 * Pull BookedCalls rows from HolySheet → CRM leads → Data Hub contacts.
 */
async function syncFromHolySheet({ sheetName = 'BookedCalls', userId = null, userRole = null, skipAudit = false } = {}) {
  const apiKey = process.env.HOLYSHEET_BOOKED_CALLS_API_KEY || '';

  let rows = [];
  try {
    rows = await holySheet.getRowsCustomKey(sheetName, apiKey);
  } catch (err) {
    logger.warn('bookedCallsSync', err.message);
    return {
      success: true,
      message: 'HolySheet booked calls sync skipped (sheet unavailable).',
      addedCount: 0,
      updatedCount: 0,
      rowCount: 0,
    };
  }

  let addedCount = 0;
  let updatedCount = 0;

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
    const city = row.city || row.City || row.location || row.Location || '';

    const filter = { $or: [] };
    if (phone) filter.$or.push({ phone });
    if (email) filter.$or.push({ email });

    const existing = await Lead.findOne(filter);

    if (existing) {
      let assignedRepId = existing.assignedRepId;
      if (!assignedRepId) {
        assignedRepId = await assignLeadToRep();
      }

      await LeadService.updateLead(
        { _id: existing._id },
        {
          $set: {
            assignedRepId,
            nextFollowupDate: date,
            nextFollowupTime: time,
            reminderSent: false,
            notifiedOverdue: false,
            callStatus: 'Scheduled',
            leadStatus: 'Warm',
            source,
            remarks: `${existing.remarks ? `${existing.remarks} • ` : ''}${remarks}`,
            ...(city ? { city } : {}),
          },
        }
      );
      updatedCount += 1;
    } else {
      const assignedRepId = await assignLeadToRep();
      await LeadService.createLead({
        name,
        email,
        phone: phone || '0000000000',
        city,
        leadStatus: 'Warm',
        callStatus: 'Scheduled',
        nextFollowupDate: date,
        nextFollowupTime: time,
        source,
        remarks,
        assignedRepId,
      });
      addedCount += 1;
    }
  }

  if (!skipAudit && userId && (addedCount > 0 || updatedCount > 0)) {
    await CRMAudit.create({
      userId,
      userRole: userRole || 'admin',
      action: 'BOOKING_SYNC',
      fieldChanged: 'leads',
      oldValue: 'holysheet_booked_calls',
      newValue: ['added', addedCount, 'updated', updatedCount].join('_'),
      notes: `Ingested ${addedCount} new bookings and updated ${updatedCount} existing leads with scheduled followups.`,
    });
  }

  return {
    success: true,
    message: `Synchronized ${rows.length} booked call rows (${addedCount} new, ${updatedCount} updated).`,
    addedCount,
    updatedCount,
    rowCount: rows.length,
  };
}

module.exports = {
  syncFromHolySheet,
};
