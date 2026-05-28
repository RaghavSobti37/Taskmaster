const Lead = require('../models/Lead');
const ExlyBooking = require('../models/ExlyBooking');
const {
  computeBookingBreakdown,
  computeConversionRate
} = require('../utils/exlyMetrics');

/**
 * Recompute and persist offering aggregates from ExlyBooking + CRM leads.
 */
async function recalculateOfferingMetrics(offering) {
  const bookingsForOff = await ExlyBooking.find({ offeringId: offering.offeringId }).lean();
  const breakdown = computeBookingBreakdown(bookingsForOff);

  const leadsForOffering = await Lead.find({
    $or: [
      { exlyOfferingId: offering.offeringId },
      { exlyOfferingTitle: offering.title },
      { source: offering.title }
    ]
  }).lean();

  const convertedBookings = leadsForOffering.filter((lead) => lead.leadStatus === 'Converted').length;
  const conversionRate = computeConversionRate(convertedBookings, breakdown.totalBookings);

  offering.totalBookings = breakdown.totalBookings;
  offering.paidBookings = breakdown.paidBookings;
  offering.freeBookings = breakdown.freeBookings;
  offering.totalRevenue = breakdown.totalRevenue;
  offering.avgOrderValue = breakdown.avgOrderValue;
  offering.conversionRate = conversionRate;
  await offering.save();

  return {
    ...breakdown,
    conversionRate,
    convertedBookings
  };
}

module.exports = {
  recalculateOfferingMetrics
};
