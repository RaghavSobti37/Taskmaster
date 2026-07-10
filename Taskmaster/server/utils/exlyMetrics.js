/**
 * Shared Exly booking/revenue metrics — single source of truth for paid vs free logic.
 * Paid = pricePaid > 0. Free = pricePaid is 0 or missing.
 */

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const getPricePaid = (booking) => {
  const price = Number(booking?.pricePaid);
  return Number.isFinite(price) ? price : 0;
};

const isPaidBooking = (booking) => getPricePaid(booking) > 0;

const isFreeBooking = (booking) => getPricePaid(booking) <= 0;

const computeBookingBreakdown = (bookings = []) => {
  let paidBookings = 0;
  let freeBookings = 0;
  let totalRevenue = 0;
  let paidRevenue = 0;

  for (const booking of bookings) {
    const price = getPricePaid(booking);
    totalRevenue += price;
    if (price > 0) {
      paidBookings += 1;
      paidRevenue += price;
    } else {
      freeBookings += 1;
    }
  }

  const totalBookings = bookings.length;
  const avgOrderValue = paidBookings > 0 ? roundMoney(paidRevenue / paidBookings) : 0;

  return {
    totalBookings,
    paidBookings,
    freeBookings,
    totalRevenue: roundMoney(totalRevenue),
    paidRevenue: roundMoney(paidRevenue),
    avgOrderValue
  };
};

const computeConversionRate = (convertedCount, totalBookings) =>
  totalBookings > 0 ? Number(((convertedCount / totalBookings) * 100).toFixed(1)) : 0;

const buildDailyChartData = (bookings = []) => {
  const dailyMap = new Map();

  for (const booking of bookings) {
    if (!booking?.bookedOn) continue;
    const date = new Date(booking.bookedOn);
    if (Number.isNaN(date.getTime())) continue;

    const dateStr = date.toISOString().split('T')[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        revenue: 0,
        bookings: 0,
        paidBookings: 0,
        freeBookings: 0
      });
    }

    const dayData = dailyMap.get(dateStr);
    const price = getPricePaid(booking);
    dayData.revenue = roundMoney(dayData.revenue + price);
    dayData.bookings += 1;
    if (price > 0) {
      dayData.paidBookings += 1;
    } else {
      dayData.freeBookings += 1;
    }
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

const getCustomerKey = (booking) => {
  const email = booking?.email?.toLowerCase().trim() || '';
  const phone = booking?.phone?.trim() || '';
  return `${email}-${phone}`;
};

module.exports = {
  roundMoney,
  getPricePaid,
  isPaidBooking,
  isFreeBooking,
  computeBookingBreakdown,
  computeConversionRate,
  buildDailyChartData,
  getCustomerKey
};
