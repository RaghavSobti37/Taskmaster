const logger = require('../utils/logger');

function autoMailerCampaignsUrl() {
  const origin = String(process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app').replace(/\/+$/, '');
  return origin.endsWith('/campaigns') ? origin : `${origin}/campaigns`;
}

const movedToAutoMailerResult = () => ({
  success: false,
  queuedCount: 0,
  async: false,
  service: 'auto-mailer',
  url: autoMailerCampaignsUrl(),
  message: 'Campaign email dispatch moved to Auto-Mailer',
});

const dispatchCampaignJobs = async (campaignId) => {
  logger.warn('Queue Service', 'Blocked CoreKnot campaign dispatch; use Auto-Mailer', {
    campaignId: String(campaignId || ''),
  });
  return movedToAutoMailerResult();
};

const stopCampaign = async (campaignId) => {
  logger.warn('Queue Service', 'Blocked CoreKnot campaign stop; use Auto-Mailer', {
    campaignId: String(campaignId || ''),
  });
  return {
    ...movedToAutoMailerResult(),
    cancelledCount: 0,
    removedFromQueue: 0,
    removedFromBull: 0,
  };
};

const processEmailJob = async (jobData = {}) => {
  logger.warn('Queue Service', 'Blocked CoreKnot campaign email job; use Auto-Mailer', {
    campaignId: String(jobData.campaignId || ''),
    recipientId: String(jobData.recipientId || ''),
  });
  return movedToAutoMailerResult();
};

const drainMemoryQueue = async () => {};
const isCampaignStopped = () => false;

const resumeStuckCampaigns = async () => {
  logger.info('Queue Service', 'Skipped campaign resume; campaign dispatch moved to Auto-Mailer');
  return { resumed: 0, rateLimitRecovered: 0, service: 'auto-mailer' };
};

const runCampaignDispatchLoop = async (campaignId) => {
  logger.warn('Queue Service', 'Blocked CoreKnot campaign dispatch loop; use Auto-Mailer', {
    campaignId: String(campaignId || ''),
  });
  return movedToAutoMailerResult();
};

module.exports = {
  dispatchCampaignJobs,
  stopCampaign,
  processEmailJob,
  movedToAutoMailerResult,
  drainMemoryQueue,
  isCampaignStopped,
  resumeStuckCampaigns,
  runCampaignDispatchLoop,
};
