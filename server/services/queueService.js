const nodemailer = require('nodemailer');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const Lead = require('../models/Lead');
const MailEvent = require('../models/MailEvent');
const { prepareCampaignHTML } = require('../utils/emailTracker');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
};

const connection = new IORedis(redisConfig.port, redisConfig.host, {
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 1000);
  }
});

connection.on('error', (err) => {});

let emailQueue;
let emailWorker;
let useBullMQ = false;

connection.connect().then(() => {
  useBullMQ = true;
  console.log('[Queue] Redis connected successfully. Initializing BullMQ.');
  emailQueue = new Queue('mail-dispatch-queue', { connection });
  
  emailWorker = new Worker('mail-dispatch-queue', async job => {
    return await processEmailJob(job.data);
  }, { 
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  });

  emailWorker.on('completed', job => {
    console.log(`[Queue] Job ${job.id} completed.`);
  });
  emailWorker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err);
  });
}).catch(err => {
  console.log('[Queue] Redis not reachable on Windows host. Using robust async In-Memory Queue fallback.');
  useBullMQ = false;
});

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
      console.error('[Queue Fallback] Job failed:', err);
    }
    await new Promise(res => setTimeout(res, 100));
  }
  isProcessingMemoryQueue = false;
};

const processEmailJob = async ({ campaignId, recipientId, email, subject, content, profileId, isLegacy }) => {
  const Campaign = require('../models/Campaign');
  const MailCampaign = require('../models/MailCampaign');
  const EmailProfile = require('../models/EmailProfile');
  const MailEvent = require('../models/MailEvent');
  const nodemailer = require('nodemailer');
  const { prepareCampaignHTML } = require('../utils/emailTracker');

  let Model = Campaign;
  let campaign = await Campaign.findById(campaignId).populate('senderProfileId');
  if (!campaign) {
    campaign = await MailCampaign.findById(campaignId).populate('senderProfileId');
    Model = MailCampaign;
    isLegacy = true;
  }
  if (!campaign) return;

  const profile = campaign.senderProfileId || (profileId ? await EmailProfile.findById(profileId) : null) || {
    name: 'Taskmaster Core Engine',
    email: 'system@taskmaster.internal',
    smtpHost: 'mock_smtp_host'
  };
  if (!profile) throw new Error('Sender profile not found');

  const { resend } = require('./mailDriver');
  let transporter = null;
  if (!resend && profile.smtpHost && profile.smtpHost !== 'mock_smtp_host') {
    transporter = nodemailer.createTransport({
      host: profile.smtpHost || 'smtp.gmail.com',
      port: profile.smtpPort || 587,
      secure: profile.smtpPort === 465,
      auth: {
        user: profile.smtpUser,
        pass: profile.smtpPass
      },
      tls: { rejectUnauthorized: false }
    });
  }

  const baseUrl = 'https://tsccoreknot.com';
  const { processedHtml, pixelId, clickId } = await prepareCampaignHTML(content || campaign.content || '', campaign.campaignId || campaign._id.toString(), email, baseUrl);

  const senderFrom = `"${profile.name}" <${profile.email}>`;
  const mailSubject = subject || campaign.subject || campaign.title;

  let messageIdStr = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const checkCompletion = async () => {
    const freshCamp = await Model.findById(campaignId);
    if (freshCamp && freshCamp.recipients) {
      const isDone = freshCamp.recipients.every(r => r.status !== 'Pending' && r.status !== 'Queued');
      if (isDone) {
        freshCamp.status = 'Completed';
        try { await freshCamp.save(); } catch (e) {}
      }
    }
  };

  try {
    if (resend) {
      const resp = await resend.emails.send({
        from: senderFrom,
        to: [email],
        subject: mailSubject,
        html: processedHtml,
        headers: {
          'X-Campaign-ID': campaign.campaignId || campaign._id.toString()
        }
      });
      messageIdStr = resp?.id || resp?.data?.id || messageIdStr;
    } else if (transporter) {
      const info = await transporter.sendMail({
        from: senderFrom,
        to: email,
        subject: mailSubject,
        html: processedHtml,
        headers: {
          'X-Campaign-ID': campaign.campaignId || campaign._id.toString()
        }
      });
      messageIdStr = info.messageId;
    } else {
      console.log(`[Queue Simulation] Simulated dispatch to ${email}`);
    }

    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find(r => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Sent';
      recipient.sentAt = new Date();
      recipient.messageId = messageIdStr;
    }

    if (isLegacy) {
      campaign.stats.sent = (campaign.stats.sent || 0) + 1;
    } else {
      if (!campaign.metrics) campaign.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
      campaign.metrics.totalSent = (campaign.metrics.totalSent || 0) + 1;
    }
    try { await campaign.save(); } catch (err) { if (err.name !== 'VersionError' && err.name !== 'DocumentNotFoundError') console.error('Campaign save error:', err); }

    await MailEvent.create({
      messageId: messageIdStr,
      eventType: 'Send',
      email: email,
      timestamp: new Date(),
      campaignId: campaign._id
    });

    await checkCompletion();
  } catch (err) {
    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find(r => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Failed';
      recipient.error = err.message;
    }
    try { await campaign.save(); } catch (e) { if (e.name !== 'VersionError' && e.name !== 'DocumentNotFoundError') console.error('Campaign fail save error:', e); }
    await checkCompletion();
    throw err;
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
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
  if (recipients.length === 0 && (campaign.recipients || []).length > 0) {
    // Reset all recipients back to Pending to allow testing re-dispatch
    for (const r of campaign.recipients) {
      r.status = 'Pending';
      delete r.error;
      delete r.sentAt;
    }
    recipients = campaign.recipients;
  }

  const { triggerEmailCampaign } = require('./triggerService');
  
  for (const rec of recipients) {
    rec.status = 'Queued';
    const jobData = {
      campaignId: campaign._id.toString(),
      recipientId: rec._id.toString(),
      email: rec.email,
      subject: campaign.subject || campaign.title,
      content: campaign.content,
      profileId: campaign.senderProfileId ? campaign.senderProfileId.toString() : null,
      isLegacy
    };

    const triggered = await triggerEmailCampaign(jobData);
    if (!triggered) {
      if (useBullMQ && emailQueue) {
        await emailQueue.add('send-email', jobData, { removeOnComplete: true, removeOnFail: false });
      } else {
        memoryQueue.push(jobData);
      }
    }
  }
  await campaign.save();

  if (!useBullMQ && (!process.env.TRIGGER_API_KEY || process.env.TRIGGER_API_KEY === 'tr_mock_api_key')) {
    processMemoryQueue();
  }

  return { success: true, queuedCount: recipients.length };
};

module.exports = { dispatchCampaignJobs, processEmailJob };
