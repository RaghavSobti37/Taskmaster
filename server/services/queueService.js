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

// Check if Redis is up without throwing unhandled exceptions
const connection = new IORedis(redisConfig.port, redisConfig.host, {
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts and fallback
    }
    return Math.min(times * 100, 1000);
  }
});

connection.on('error', (err) => {
  // Suppress background ioredis socket errors when falling back to in-memory queue
});

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
    limiter: { max: 10, duration: 1000 } // Throttling: 10 emails per second max
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

// In-Memory Queue fallback processor
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
    // Throttle 100ms between emails
    await new Promise(res => setTimeout(res, 100));
  }
  isProcessingMemoryQueue = false;
};

const processEmailJob = async ({ campaignId, recipientId, email, subject, content, profileId, isLegacy }) => {
  const Model = isLegacy ? MailCampaign : Campaign;
  const campaign = await Model.findById(campaignId).populate('senderProfileId');
  if (!campaign) return;

  const profile = campaign.senderProfileId || await EmailProfile.findById(profileId);
  if (!profile) throw new Error('Sender profile not found');

  const transporter = nodemailer.createTransport({
    host: profile.smtpHost || 'smtp.gmail.com',
    port: profile.smtpPort || 587,
    secure: profile.smtpPort === 465,
    auth: {
      user: profile.smtpUser,
      pass: profile.smtpPass
    },
    tls: { rejectUnauthorized: false }
  });

  const baseUrl = process.env.APP_BASE_URL || process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
  const { processedHtml, pixelId, clickId } = await prepareCampaignHTML(content, campaign.campaignId || campaign._id.toString(), email, baseUrl);

  const mailOptions = {
    from: `"${profile.name}" <${profile.email}>`,
    to: email,
    subject: subject || campaign.subject || campaign.title,
    html: processedHtml,
    headers: {
      'X-Campaign-ID': campaign.campaignId || campaign._id.toString()
    }
  };

  const checkCompletion = async () => {
    const freshCamp = await Model.findById(campaignId);
    if (freshCamp && freshCamp.recipients) {
      const isDone = freshCamp.recipients.every(r => r.status !== 'Pending' && r.status !== 'Queued');
      if (isDone) {
        freshCamp.status = 'Completed';
        await freshCamp.save();
      }
    }
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    
    // Update recipient and stats
    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find(r => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Sent';
      recipient.sentAt = new Date();
      recipient.messageId = info.messageId;
    }

    if (isLegacy) {
      campaign.stats.sent = (campaign.stats.sent || 0) + 1;
    } else {
      campaign.metrics.totalSent = (campaign.metrics.totalSent || 0) + 1;
    }
    await campaign.save();

    await MailEvent.create({
      messageId: info.messageId,
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
    await campaign.save();
    await checkCompletion();
    throw err;
  }
};

const dispatchCampaignJobs = async (campaignId, isLegacy = false) => {
  const Model = isLegacy ? MailCampaign : Campaign;
  const campaign = await Model.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  campaign.status = 'Sending';
  await campaign.save();

  const recipients = (campaign.recipients || []).filter(r => r.status === 'Pending' || r.status === 'Queued');
  
  for (const rec of recipients) {
    rec.status = 'Queued';
    const jobData = {
      campaignId: campaign._id.toString(),
      recipientId: rec._id.toString(),
      email: rec.email,
      subject: campaign.subject,
      content: campaign.content,
      profileId: campaign.senderProfileId ? campaign.senderProfileId.toString() : null,
      isLegacy
    };

    if (useBullMQ && emailQueue) {
      await emailQueue.add('send-email', jobData, { removeOnComplete: true, removeOnFail: false });
    } else {
      memoryQueue.push(jobData);
    }
  }
  await campaign.save();

  if (!useBullMQ) {
    processMemoryQueue();
  }

  return { success: true, queuedCount: recipients.length };
};

module.exports = { dispatchCampaignJobs, processEmailJob };
