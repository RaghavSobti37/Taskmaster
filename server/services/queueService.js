const nodemailer = require('nodemailer');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const Lead = require('../models/Lead');
const MailEvent = require('../models/MailEvent');
const { prepareCampaignHTML } = require('../utils/emailTracker');
const logger = require('../utils/logger');
const { resolveCampaignByParam } = require('../utils/resolveCampaign');
const { isValidEmail } = require('../utils/emailValidation');

const {
  isCampaignStopped,
  markCampaignStopped,
  clearCampaignStopped,
} = require('./campaignQueueState');
const { processEmailJob } = require('./emailProcessor');

const memoryQueue = [];
let isProcessingMemoryQueue = false;

const removeCampaignJobsFromMemoryQueue = (campaignId) => {
  const id = String(campaignId);
  let removedFromQueue = 0;
  for (let i = memoryQueue.length - 1; i >= 0; i--) {
    if (String(memoryQueue[i].campaignId) === id) {
      memoryQueue.splice(i, 1);
      removedFromQueue++;
    }
  }
  return removedFromQueue;
};

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

const stopCampaign = async (campaignId) => {
  const resolved = await resolveCampaignByParam(campaignId);
  if (!resolved) throw new Error('Campaign not found');

  const { campaign } = resolved;
  if (campaign.status !== 'Sending' && campaign.status !== 'Queued') {
    throw new Error(`Cannot stop campaign with status "${campaign.status}"`);
  }

  const id = campaign._id.toString();
  markCampaignStopped(id);

  let cancelledCount = 0;
  for (const rec of campaign.recipients || []) {
    if (rec.status === 'Pending' || rec.status === 'Queued') {
      rec.status = 'Cancelled';
      cancelledCount++;
    }
  }

  campaign.status = 'Stopped';
  campaign.stoppedAt = new Date();
  await campaign.save();

  const removedFromQueue = removeCampaignJobsFromMemoryQueue(id);

  return {
    success: true,
    cancelledCount,
    removedFromQueue,
    stoppedAt: campaign.stoppedAt,
  };
};

const dispatchCampaignJobs = async (campaignId) => {
  const resolved = await resolveCampaignByParam(campaignId);
  if (!resolved) throw new Error('Campaign not found');

  const { campaign, isLegacy, Model } = resolved;

  if (campaign.status === 'Stopped') {
    return { success: false, queuedCount: 0, message: 'Campaign is stopped' };
  }

  if (!isLegacy && campaign.status === 'Draft') {
    return { success: false, queuedCount: 0, message: 'Campaign is a draft — dispatch explicitly to send' };
  }

  campaign.status = 'Sending';
  await campaign.save();
  clearCampaignStopped(campaign._id.toString());

  let recipients = (campaign.recipients || []).filter(r => r.status === 'Pending' || r.status === 'Queued');
  if (recipients.length === 0) {
    return { success: true, queuedCount: 0, message: 'All recipients are already processed or queued' };
  }

  const invalidRecipients = recipients.filter((r) => !isValidEmail(r.email));
  if (invalidRecipients.length > 0) {
    for (const rec of invalidRecipients) {
      rec.status = 'Invalid';
      rec.error = 'Invalid email address';
    }
    await campaign.save();
    recipients = recipients.filter((r) => isValidEmail(r.email));
    if (recipients.length === 0) {
      return { success: true, queuedCount: 0, message: 'No valid recipients to queue' };
    }
  }

  const { triggerEmailCampaign } = require('./triggerService');
  
  for (const rec of recipients) {
    rec.status = 'Queued';
  }
  await campaign.save();

  const jobDataList = recipients.map((rec, i) => ({
    campaignId: campaign._id.toString(),
    recipientId: rec._id.toString(),
    email: rec.email,
    subject: campaign.subject || campaign.title,
    content: campaign.content,
    profileId: campaign.senderProfileId ? campaign.senderProfileId.toString() : null,
    isLegacy,
    jobIndex: i,
  }));

  const BATCH_SIZE = 25;
  for (let i = 0; i < jobDataList.length; i += BATCH_SIZE) {
    const batch = jobDataList.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (jobData) => {
      const triggered = await triggerEmailCampaign(jobData);
      if (!triggered) memoryQueue.push(jobData);
    }));
  }

  if (!process.env.TRIGGER_API_KEY || process.env.TRIGGER_API_KEY === 'tr_mock_api_key') {
    processMemoryQueue();
  }

  const { syncProviderUsageFromEvents } = require('./profileSendStats');
  syncProviderUsageFromEvents().catch((err) => {
    logger.warn('Queue Service', 'Post-dispatch usage sync failed', { error: err.message });
  });

  return { success: true, queuedCount: recipients.length };
};

/** Wait for in-memory fallback queue to finish (tests / graceful shutdown). */
const drainMemoryQueue = async (timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while ((memoryQueue.length > 0 || isProcessingMemoryQueue) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  memoryQueue.length = 0;
  isProcessingMemoryQueue = false;
};

module.exports = {
  dispatchCampaignJobs,
  stopCampaign,
  processEmailJob,
  drainMemoryQueue,
  isCampaignStopped,
};
