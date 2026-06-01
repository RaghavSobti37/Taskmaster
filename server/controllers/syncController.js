const logger = require('../utils/logger');
const { getDepartmentSlug } = require('../utils/departmentPermissions');
const { syncFromHolySheet } = require('../services/bookedCallsSyncService');

/**
 * Sync call bookings from HolySheet BookedCalls sheet → CRM + Data Hub.
 */
exports.syncBookings = async (req, res) => {
  try {
    const result = await syncFromHolySheet({
      sheetName: req.query.sheet || 'BookedCalls',
      userId: req.user._id,
      userRole: getDepartmentSlug(req.user),
    });
    res.json({
      ...result,
      duplicateCount: 0,
      message: result.addedCount || result.updatedCount
        ? `Successfully synchronized booked calls. ${result.addedCount} new leads created, ${result.updatedCount} existing leads updated with follow-up appointments.`
        : result.message,
    });
  } catch (error) {
    logger.error('Sync', error.message);
    res.status(500).json({ success: false, error: error.message || 'Sync failed' });
  }
};
