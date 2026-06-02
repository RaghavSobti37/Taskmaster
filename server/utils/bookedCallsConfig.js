/**
 * Booked calls: TSC Website → POST /api/webhooks/book-call → CRM Lead only.
 */

function getBookedCallsPublicConfig() {
  return {
    mode: 'crm_direct',
    crmOnly: true,
    legacySheetSyncEnabled: false,
    websiteWebhookPath: '/api/webhooks/book-call',
    primarySource: 'Website Booking',
  };
}

module.exports = {
  getBookedCallsPublicConfig,
};
