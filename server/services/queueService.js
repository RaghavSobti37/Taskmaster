const nodemailer = require('nodemailer');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const Lead = require('../models/Lead');
const MailEvent = require('../models/MailEvent');
const { prepareCampaignHTML } = require('../utils/emailTracker');
const logger = require('../utils/logger');
const { processEmailJob } = require('./emailProcessor');

const memoryQueue = [];
let isProcessingMemoryQueue = false;

const processMemoryQueue = async () => {
  if (isProcessingMemoryQueue || memoryQueue.length === 0) return;
  isProcessingMemoryQueue = true;

  while (memoryQueue.length > 0) {
    const jobData = memoryQueue.shift();
    try {
      await processEmailJob(jobData);
    } catch (err) {
      logger.error('Memory Queue', 'Job failed', { error: err.message });
    }
    await new Promise(res => setTimeout(res, 100));
  }
  isProcessingMemoryQueue = false;
};

const dispatchCampaignJobs = async (campaignId) => {
  const Campaign = require('../models/Campaign');
  const MailCampaign = require('../models/MailCampaign');
  let isLegacy = false;
  let Model = Campaign;

  let campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    campaign = await MailCampaign.findById(campaignId);
    Model = MailCampaign;
    isLegacy = true;
  }
  if (!campaign) throw new Error('Campaign not found');

  campaign.status = 'Sending';
  await campaign.save();

  let recipients = (campaign.recipients || []).filter(r => r.status === 'Pending' || r.status === 'Queued');
  if (recipients.length === 0) {
    return { success: true, queuedCount: 0, message: 'All recipients are already processed or queued' };
  }

  const { triggerEmailCampaign } = require('./triggerService');
  
  for (const rec of recipients) {
    rec.status = 'Queued';
  }
  await campaign.save();

  for (let i = 0; i < recipients.length; i++) {
    const rec = recipients[i];
    const jobData = {
      campaignId: campaign._id.toString(),
      recipientId: rec._id.toString(),
      email: rec.email,
      subject: campaign.subject || campaign.title,
      content: campaign.content,
      profileId: campaign.senderProfileId ? campaign.senderProfileId.toString() : null,
      isLegacy,
      jobIndex: i
    };

    const triggered = await triggerEmailCampaign(jobData);
    if (!triggered) {
      memoryQueue.push(jobData);
    }
  }

  if (!process.env.TRIGGER_API_KEY || process.env.TRIGGER_API_KEY === 'tr_mock_api_key') {
    processMemoryQueue();
  }

  return { success: true, queuedCount: recipients.length };
};

module.exports = { dispatchCampaignJobs, processEmailJob };
