export const shortenOfferingTitle = (title, maxLength = 40) => {
  if (!title) return '—';
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 1).trim()}…`;
};

/** Shorter label for dense table cells */
export const shortenOfferingTitleCompact = (title, maxLength = 28) =>
  shortenOfferingTitle(title, maxLength);

export const formatInr = (value, { exact = false } = {}) => {
  const num = Number(value) || 0;
  if (exact) {
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }
  return num.toLocaleString('en-IN');
};

export const formatPercent = (value) => {
  const num = Number(value) || 0;
  return `${num.toFixed(1)}%`;
};

const isPaidBooking = (booking) => Number(booking?.pricePaid || 0) > 0;

export const computeOfferingTotals = (offerings = []) =>
  offerings.reduce(
    (acc, offering) => ({
      totalRevenue: acc.totalRevenue + (Number(offering.totalRevenue) || 0),
      paidBookings: acc.paidBookings + (Number(offering.paidBookings) || 0),
      freeBookings: acc.freeBookings + (Number(offering.freeBookings) || 0),
      totalBookings: acc.totalBookings + (Number(offering.totalBookings) || 0)
    }),
    { totalRevenue: 0, paidBookings: 0, freeBookings: 0, totalBookings: 0 }
  );
