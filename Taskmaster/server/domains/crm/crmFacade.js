const { assignLeadToRep, assignLeadToArtistRep } = require('../../utils/crmAssignment');
const leadService = require('./services/leadService');
const {
  fetchLeadsPaginated,
  fetchLeadById,
} = require('./services/leadQueryService');

/**
 * Cross-domain CRM entry points. Prefer these over direct model imports outside domains/crm.
 */
module.exports = {
  assignLeadToRep,
  assignLeadToArtistRep,
  leadService,
  fetchLeadsPaginated,
  fetchLeadById,
};
