const QUEUE_NAME = 'CampaignEmailQueue';

function autoMailerCampaignsUrl() {
  const origin = String(process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app').replace(/\/+$/, '');
  return origin.endsWith('/campaigns') ? origin : `${origin}/campaigns`;
}

const movedToAutoMailerQueueResult = () => ({
  queued: 0,
  via: 'auto-mailer',
  movedTo: autoMailerCampaignsUrl(),
  message: 'Campaign email dispatch moved to Auto-Mailer',
});

const buildCampaignEmailJobId = (campaignId, recipientId) =>
  `${String(campaignId)}__${String(recipientId)}`;

const isCampaignEmailQueueAvailable = () => false;

const enqueueCampaignEmailJobs = async (jobDataList = []) => {
  if (!jobDataList.length) return { queued: 0, via: 'none' };
  return movedToAutoMailerQueueResult();
};

const removeCampaignJobsFromQueue = async () => 0;

module.exports = {
  QUEUE_NAME,
  movedToAutoMailerQueueResult,
  buildCampaignEmailJobId,
  isCampaignEmailQueueAvailable,
  enqueueCampaignEmailJobs,
  removeCampaignJobsFromQueue,
  getCampaignEmailConnection: () => null,
};
