const crmInletProcessor = require('./crmInletProcessor');
const exlyInletProcessor = require('./exlyInletProcessor');
const newsletterInletProcessor = require('./newsletterInletProcessor');
const outsourcedInletProcessor = require('./outsourcedInletProcessor');
const bookedCallsInletProcessor = require('./bookedCallsInletProcessor');
const enquiriesInletProcessor = require('./enquiriesInletProcessor');
const mailInletProcessor = require('./mailInletProcessor');
const artistPathInletProcessor = require('./artistPathInletProcessor');
const communityInletProcessor = require('./communityInletProcessor');
const unsubscribedInletProcessor = require('./unsubscribedInletProcessor');
const activeInletProcessor = require('./activeInletProcessor');

const SECTION_LOADERS = {
  crm: crmInletProcessor.loadCrmSection,
  exly: exlyInletProcessor.loadExlySection,
  tsc: outsourcedInletProcessor.loadOutsourcedSection,
  outsourced: outsourcedInletProcessor.loadOutsourcedSection,
  newsletter: newsletterInletProcessor.loadNewsletterSection,
  artist_path: artistPathInletProcessor.loadArtistPathSection,
  booked: bookedCallsInletProcessor.loadBookedCallsSection,
  enquiries: enquiriesInletProcessor.loadEnquiriesSection,
  mail: mailInletProcessor.loadMailSection,
};

const ANALYTICS_BUILDERS = {
  leads: crmInletProcessor.buildLeadsAnalytics,
  exly: exlyInletProcessor.buildExlyAnalytics,
  tsc: outsourcedInletProcessor.buildOutsourcedAnalytics,
  outsourced: outsourcedInletProcessor.buildOutsourcedAnalytics,
  booked_calls: bookedCallsInletProcessor.buildBookedCallsAnalytics,
  enquiries: enquiriesInletProcessor.buildEnquiriesAnalytics,
  unsubscribed: unsubscribedInletProcessor.buildUnsubscribedAnalytics,
  mail: mailInletProcessor.buildMailAnalytics,
  community: communityInletProcessor.buildCommunityAnalytics,
  active: activeInletProcessor.buildActiveAnalytics,
};

module.exports = {
  crmInletProcessor,
  exlyInletProcessor,
  newsletterInletProcessor,
  outsourcedInletProcessor,
  bookedCallsInletProcessor,
  enquiriesInletProcessor,
  mailInletProcessor,
  artistPathInletProcessor,
  communityInletProcessor,
  unsubscribedInletProcessor,
  activeInletProcessor,
  SECTION_LOADERS,
  ANALYTICS_BUILDERS,
};
