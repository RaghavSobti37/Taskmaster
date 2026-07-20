const logger = require('../../../utils/logger');
const { resolveTrackingApiBaseUrl } = require('../../../utils/trackingUrls');

const resolveTrackingBaseUrl = () => resolveTrackingApiBaseUrl();

const processEmailJob = async (jobData = {}) => {
  logger.warn('Email Processor', 'Blocked CoreKnot campaign email job; use Auto-Mailer', {
    campaignId: String(jobData.campaignId || ''),
    recipientId: String(jobData.recipientId || ''),
  });
  return {
    success: false,
    service: 'auto-mailer',
    message: 'Campaign email processing moved to Auto-Mailer',
  };
};

module.exports = { processEmailJob, resolveTrackingBaseUrl };
