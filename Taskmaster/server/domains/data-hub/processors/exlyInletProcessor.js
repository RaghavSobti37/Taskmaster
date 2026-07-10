const ExlyBooking = require('../../../models/ExlyBooking');
const ContactService = require('../../../services/ContactService');
const { isCommunityText } = require('../../../../shared/dataInlets');
const { WEEKLY_DATE_FORMAT } = require('../queryHelpers');

async function reconcileExlyBookings(exlyBookings, { primaryName, email, phone, contact: initialContact }) {
  let contact = initialContact;
  for (const booking of exlyBookings) {
    const isCommunity = isCommunityText(booking.offeringTitle);
    contact = await ContactService.mergeContact({
      name: booking.name || primaryName,
      email: booking.email || email,
      phone: booking.phone || phone,
      exlyOfferingTitle: booking.offeringTitle,
      emailStatus: booking.emailStatus,
      unsubscribed: booking.unsubscribed,
      recordId: booking._id,
      summary: { offeringTitle: booking.offeringTitle, pricePaid: booking.pricePaid },
      inletKey: isCommunity ? 'community' : 'exly',
    }, isCommunity ? 'community' : 'exly');
  }
  return contact;
}

async function loadExlySection(match) {
  const bookings = await ExlyBooking.find(match).sort({ bookedOn: -1 }).lean();
  const revenue = bookings.reduce((sum, b) => sum + (Number(b.pricePaid) || 0), 0);
  return {
    section: 'exly',
    exly: {
      bookings,
      revenue,
      offerings: [...new Set(bookings.map((b) => b.offeringTitle))],
    },
  };
}

function appendExlyTimeline(exlyBookings) {
  return exlyBookings.map((b) => ({
    type: 'exly',
    date: b.bookedOn || b.createdAt,
    label: `Exly: ${b.offeringTitle}`,
    data: b,
  }));
}

function sumExlyRevenue(exlyBookings) {
  return exlyBookings.reduce((sum, b) => sum + (Number(b.pricePaid) || 0), 0);
}

async function buildExlyAnalytics(result, { monthAgo }) {
  const [revenueAgg, topOfferings, newMonth, bookingTrend] = await Promise.all([
    ExlyBooking.aggregate([
      { $group: { _id: null, revenue: { $sum: '$pricePaid' }, count: { $sum: 1 } } },
    ]),
    ExlyBooking.aggregate([
      { $group: { _id: '$offeringTitle', count: { $sum: 1 }, revenue: { $sum: '$pricePaid' } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
    ExlyBooking.countDocuments({ bookedOn: { $gte: monthAgo } }),
    ExlyBooking.aggregate([
      { $match: { bookedOn: { $gte: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: WEEKLY_DATE_FORMAT, date: '$bookedOn' } }, count: { $sum: 1 }, revenue: { $sum: '$pricePaid' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const rev = revenueAgg[0] || { revenue: 0, count: 0 };
  result.topOfferings = topOfferings;
  result.bookingTrend = bookingTrend;
  result.kpis = [
    { key: 'bookings', label: 'Total Bookings', value: rev.count },
    { key: 'revenue', label: 'Total Revenue', value: Math.round(rev.revenue || 0), format: 'currency' },
    {
      key: 'avgTicket',
      label: 'Avg Ticket',
      value: rev.count ? Math.round((rev.revenue || 0) / rev.count) : 0,
      format: 'currency',
    },
    { key: 'newMonth', label: 'Bookings (30d)', value: newMonth },
  ];
}

module.exports = {
  reconcileExlyBookings,
  loadExlySection,
  appendExlyTimeline,
  sumExlyRevenue,
  buildExlyAnalytics,
};
