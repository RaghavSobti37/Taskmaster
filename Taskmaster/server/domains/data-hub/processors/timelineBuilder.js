const { appendLeadTimeline } = require('./crmInletProcessor');
const { appendOutsourcedTimeline } = require('./outsourcedInletProcessor');
const { appendBookedCallsTimeline } = require('./bookedCallsInletProcessor');
const { appendNewsletterTimeline } = require('./newsletterInletProcessor');
const { appendExlyTimeline } = require('./exlyInletProcessor');
const { appendEnquiriesTimeline } = require('./enquiriesInletProcessor');
const { appendMailTimeline } = require('./mailInletProcessor');

function buildTimeline({
  leads,
  outsourced,
  bookedCallRecords,
  newsletter,
  exlyBookings,
  filteredEnquiries,
  mailEvents,
}) {
  const timeline = [
    ...appendLeadTimeline(leads),
    ...appendOutsourcedTimeline(outsourced),
    ...appendBookedCallsTimeline(bookedCallRecords),
    ...appendNewsletterTimeline(newsletter),
    ...appendExlyTimeline(exlyBookings),
    ...appendEnquiriesTimeline(filteredEnquiries),
    ...appendMailTimeline(mailEvents),
  ];
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  return timeline;
}

module.exports = {
  buildTimeline,
};
