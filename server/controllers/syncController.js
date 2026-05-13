const holySheet = require('../utils/holySheet');
const Lead = require('../models/Lead');
const User = require('../models/User');

/**
 * Sync Call Bookings from HolySheet
 */
exports.syncBookings = async (req, res) => {
  try {
    const sheetName = req.query.sheet || 'Bookings'; // User needs to confirm sheet name
    const rows = await holySheet.getRows(sheetName);
    
    let addedCount = 0;
    let duplicateCount = 0;

    for (const row of rows) {
      // Basic check for existence (e.g., by phone or email)
      const phone = row.phone || row.Phone || row['Mobile Number'];
      const email = row.email || row.Email;

      if (!phone && !email) continue;

      const existing = await Lead.findOne({ 
        $or: [
          { phone: phone || '___' },
          { email: email || '___' }
        ]
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      // Create new lead (unassigned as requested)
      await Lead.create({
        name: row.name || row.Name || row['Full Name'] || 'New Booking',
        email: email || '',
        phone: phone || '0000000000',
        leadStatus: 'New',
        callStatus: 'Pending',
        webinarDates: row.webinar_dates || row.webinarDates || 'Booking Sync',
        remarks: `AUTO-SYNC: Booking received from ${sheetName}`,
        assignedRepId: null // Allow reps to assign themselves
      });

      addedCount++;
    }

    if (addedCount > 0) {
      const CRMAudit = require('../models/CRMAudit');
      await CRMAudit.create({
        userId: req.user._id,
        userRole: req.user.role,
        action: 'BOOKING_SYNC',
        fieldChanged: 'leads',
        oldValue: 'external',
        newValue: `sync_${addedCount}`,
        notes: `Successfully ingested ${addedCount} new bookings from HolySheet.`
      });
    }

    res.json({
      success: true,
      message: `${addedCount} new bookings ingested. ${duplicateCount} duplicates skipped.`,
      addedCount,
      duplicateCount
    });

  } catch (error) {
    console.error('[SYNC ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
};
