const Lead = require('../models/Lead');
const CRMConfig = require('../models/CRMConfig');
const { mergeLeadStatusOptions } = require('../../../utils/crmPipelineFilters');
const { getBookedCallsPublicConfig } = require('../../../utils/bookedCallsConfig');

const { listImportSheetFilters } = require('../../../shared/artistCrmSheetAssignees');

async function getCRMConfig() {
  const knownSheetSources = listImportSheetFilters().map((s) => s.source);
  const [callStatuses, leadStatuses, artistTypes, webinarDates, meaningfulConnectStatuses, sources, qualities] = await Promise.all([
    Lead.distinct('callStatus'),
    Lead.distinct('leadStatus'),
    Lead.distinct('artistType'),
    Lead.distinct('webinarDates'),
    Lead.distinct('meaningfulConnect'),
    Lead.distinct('source'),
    Lead.distinct('leadQuality'),
  ]);

  let configDoc = await CRMConfig.findOne({ configKey: 'default' });
  if (!configDoc) {
    configDoc = await CRMConfig.create({
      configKey: 'default',
      callStatuses: ['Pending', 'Connected', 'Busy', 'DNP', 'Switched Off'],
      leadStatuses: ['New', 'Interested', 'Not Interested', 'Followup', 'Converted'],
      artistTypes: ['Full Time', 'Part Time', 'Hobbyist'],
      meaningfulConnectStatuses: ['YES', 'NO', 'PENDING'],
      qualities: ['1', '2', '3', '4', '5'],
    });
  }

  return {
    callStatuses: Array.from(new Set([...callStatuses.filter(Boolean), ...configDoc.callStatuses])),
    leadStatuses: mergeLeadStatusOptions(leadStatuses, configDoc.leadStatuses),
    artistTypes: Array.from(new Set([...artistTypes.filter(Boolean), ...configDoc.artistTypes])),
    webinarDates: webinarDates.filter(Boolean),
    meaningfulConnectStatuses: Array.from(new Set([...meaningfulConnectStatuses.filter(Boolean), ...configDoc.meaningfulConnectStatuses])),
    sources: Array.from(new Set([
      ...sources.filter(Boolean),
      ...knownSheetSources,
      'Organic / Direct',
      'Webinar',
      'Facebook Ads',
      'Google Ads',
      'Referral',
      'Website Booking',
      'Booked Call',
    ])),
    qualities: Array.from(new Set([...qualities.filter(Boolean), ...configDoc.qualities, '1', '2', '3', '4', '5', 'Future 4'])),
    bookedCalls: getBookedCallsPublicConfig(),
  };
}

module.exports = {
  getCRMConfig,
};
