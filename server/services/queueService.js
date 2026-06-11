const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const logger = require('../utils/logger');
const { resolveCampaignByParam } = require('../utils/resolveCampaign');
const { isValidEmail } = require('../utils/emailValidation');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { resolveCampaignTenantId } = require('../utils/resolveCampaignTenantId');
const { runWithWorkerTenant } = require('../utils/workerTenantContext');

const BYPASS = bypassOptions('CAMPAIGN_DISPATCH');

const {
  isCampaignStopped,
  markCampaignStopped,
  clearCampaignStopped,
} = require('./campaignQueueState');
const { processEmailJob } = require('./emailProcessor');

const DISPATCH_CHUNK_SIZE = 100;
const TRIGGER_BATCH_SIZE = 25;
const MEMORY_SEND_CONCURRENCY = 3;
const MEMORY_SEND_DELAY_MS = 150;

const memoryQueue = [];
let isProcessingMemoryQueue = false;
const activeDispatchLoops = new Set();

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

/** Render API server processes sends unless Trigger.dev worker is explicitly enabled. */
const usesMemoryQueue = () => {
  if (process.env.CAMPAIGN_USE_TRIGGER === 'true') {
    return !process.env.TRIGGER_API_KEY || process.env.TRIGGER_API_KEY === 'tr_mock_api_key';
  }
  return true;
};

const processMemoryQueue = async () => {
  if (isProcessingMemoryQueue || memoryQueue.length === 0) return;
  isProcessingMemoryQueue = true;

  const worker = async () => {
    while (memoryQueue.length > 0) {
      const jobData = memoryQueue.shift();
      if (!jobData) break;
      try {
        await processEmailJob(jobData);
      } catch (err) {
        logger.error('Memory Queue', 'Job failed', { error: err.message });
      }
      await new Promise((res) => setTimeout(res, MEMORY_SEND_DELAY_MS));
    }
  };

  try {
    await Promise.all(
      Array.from({ length: MEMORY_SEND_CONCURRENCY }, () => worker()),
    );
  } finally {
    isProcessingMemoryQueue = false;
    if (memoryQueue.length > 0) {
      processMemoryQueue().catch((err) => {
        logger.error('Memory Queue', 'Restart failed', { error: err.message });
      });
    }
  }
};

const countPendingRecipients = async (Model, campaignId) => {
  const rows = await Model.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(campaignId)) } },
    { $unwind: '$recipients' },
    { $match: { 'recipients.status': { $in: ['Pending', 'Queued'] } } },
    { $count: 'n' },
  ]);
  return rows[0]?.n || 0;
};

const fetchPendingRecipientChunk = async (Model, campaignId, limit = DISPATCH_CHUNK_SIZE) =>
  Model.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(campaignId)) } },
    { $unwind: '$recipients' },
    { $match: { 'recipients.status': 'Pending' } },
    { $limit: limit },
    {
      $project: {
        recipientId: '$recipients._id',
        email: '$recipients.email',
        status: '$recipients.status',
      },
    },
  ]);

const resetStuckQueuedRecipients = async (Model, campaignId) => {
  await Model.updateOne(
    { _id: campaignId },
    { $set: { 'recipients.$[elem].status': 'Pending' } },
    { arrayFilters: [{ 'elem.status': 'Queued' }], ...BYPASS },
  );
};

const markRecipientsQueued = async (Model, campaignId, recipientIds) => {
  if (!recipientIds.length) return;
  await Model.updateOne(
    { _id: campaignId },
    { $set: { 'recipients.$[elem].status': 'Queued' } },
    { arrayFilters: [{ 'elem._id': { $in: recipientIds }, 'elem.status': 'Pending' }], ...BYPASS },
  );
};

const queueRecipientJobs = async ({ Model, campaign, isLegacy, chunk, jobOffset = 0, tenantId }) => {
  const { triggerEmailCampaign } = require('./triggerService');
  const campaignId = campaign._id.toString();

  const pendingIds = chunk
    .filter((row) => row.status === 'Pending')
    .map((row) => row.recipientId);
  if (pendingIds.length) {
    await markRecipientsQueued(Model, campaign._id, pendingIds);
  }

  const jobDataList = chunk.map((row, i) => ({
    campaignId,
    recipientId: row.recipientId.toString(),
    email: row.email,
    subject: campaign.subject || campaign.title,
    content: campaign.content,
    profileId: campaign.senderProfileId
      ? (campaign.senderProfileId._id || campaign.senderProfileId).toString()
      : null,
    isLegacy,
    jobIndex: jobOffset + i,
    tenantId: tenantId ? String(tenantId) : undefined,
  }));

  for (let i = 0; i < jobDataList.length; i += TRIGGER_BATCH_SIZE) {
    const batch = jobDataList.slice(i, i + TRIGGER_BATCH_SIZE);
    await Promise.all(batch.map(async (jobData) => {
      const triggered = await triggerEmailCampaign(jobData);
      if (!triggered) memoryQueue.push(jobData);
    }));
  }

  processMemoryQueue().catch((err) => {
    logger.error('Memory Queue', 'Dispatch chunk failed', { error: err.message });
  });
};

const runCampaignDispatchLoop = async (campaignId) => {
  const id = String(campaignId);
  if (activeDispatchLoops.has(id)) return;
  activeDispatchLoops.add(id);

  try {
    const resolved = await resolveCampaignByParam(campaignId);
    if (!resolved) return;

    const { campaign, isLegacy, Model } = resolved;
    if (campaign.status === 'Stopped' || isCampaignStopped(id)) return;

    const meta = await Model.findById(campaign._id)
      .select('status subject title content senderProfileId senderProfileIds tenantId createdBy')
      .populate('senderProfileId')
      .populate('senderProfileIds')
      .setOptions(BYPASS)
      .lean();

    if (!meta || meta.status === 'Stopped' || isCampaignStopped(id)) return;

    const tenantId = await resolveCampaignTenantId(meta);
    if (!tenantId) {
      logger.error('Queue Service', `Cannot dispatch campaign ${id} — no tenantId`);
      return;
    }

    if (!meta.tenantId) {
      await Model.updateOne({ _id: campaign._id }, { $set: { tenantId } }).setOptions(BYPASS);
    }

    await runWithWorkerTenant(tenantId, async () => {
      let jobOffset = 0;
      let hasMore = true;

      while (hasMore) {
        if (isCampaignStopped(id)) break;

        const freshStatus = await Model.findById(campaign._id).select('status').setOptions(BYPASS).lean();
        if (!freshStatus || freshStatus.status === 'Stopped') break;

        const chunk = await fetchPendingRecipientChunk(Model, campaign._id, DISPATCH_CHUNK_SIZE);
        if (!chunk.length) {
          hasMore = false;
          break;
        }

        await queueRecipientJobs({
          Model,
          campaign: meta,
          isLegacy,
          chunk,
          jobOffset,
          tenantId,
        });
        jobOffset += chunk.length;

        hasMore = chunk.length === DISPATCH_CHUNK_SIZE;
        if (hasMore) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      const { syncProviderUsageFromEvents } = require('./profileSendStats');
      syncProviderUsageFromEvents().catch((err) => {
        logger.warn('Queue Service', 'Post-dispatch usage sync failed', { error: err.message });
      });
    });
  } catch (err) {
    logger.error('Queue Service', `Dispatch loop failed for campaign ${id}`, { error: err.message });
  } finally {
    activeDispatchLoops.delete(id);
  }
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

const markInvalidPendingRecipients = async (Model, campaignId) => {
  const rows = await Model.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(campaignId)) } },
    { $unwind: '$recipients' },
    { $match: { 'recipients.status': { $in: ['Pending', 'Queued'] } } },
    { $project: { _id: '$recipients._id', email: '$recipients.email' } },
  ]);
  const invalidIds = rows.filter((row) => !isValidEmail(row.email)).map((row) => row._id);
  if (!invalidIds.length) return;

  await Model.updateOne(
    { _id: campaignId },
    {
      $set: {
        'recipients.$[elem].status': 'Invalid',
        'recipients.$[elem].error': 'Invalid email address',
      },
    },
    {
      arrayFilters: [{ 'elem._id': { $in: invalidIds } }],
      ...BYPASS,
    },
  );
};

const dispatchCampaignJobs = async (campaignId) => {
  const resolved = await resolveCampaignByParam(campaignId, { excludeRecipients: true });
  if (!resolved) throw new Error('Campaign not found');

  const { campaign, isLegacy, Model } = resolved;

  if (campaign.status === 'Stopped') {
    return { success: false, queuedCount: 0, message: 'Campaign is stopped' };
  }

  if (!isLegacy && campaign.status === 'Draft') {
    return { success: false, queuedCount: 0, message: 'Campaign is a draft — dispatch explicitly to send' };
  }

  await markInvalidPendingRecipients(Model, campaign._id);

  const pendingCount = await countPendingRecipients(Model, campaign._id);
  if (pendingCount === 0) {
    return { success: true, queuedCount: 0, message: 'All recipients are already processed or queued' };
  }

  await Model.updateOne({ _id: campaign._id }, { $set: { status: 'Sending' } }).setOptions(BYPASS);
  clearCampaignStopped(campaign._id.toString());

  setImmediate(() => {
    runCampaignDispatchLoop(campaign._id).catch((err) => {
      logger.error('Queue Service', 'Background dispatch failed', { error: err.message });
    });
  });

  return {
    success: true,
    queuedCount: pendingCount,
    message: 'Dispatch started — emails send in background batches',
    async: true,
  };
};

const resumeStuckCampaigns = async () => {
  if (process.env.NODE_ENV === 'test') return { resumed: 0 };

  const filter = { status: { $in: ['Sending', 'Queued'] } };
  let resumed = 0;

  const resumeForModel = async (Model) => {
    const stuck = await Model.find(filter).select('_id title').lean();
    for (const camp of stuck) {
      const pending = await countPendingRecipients(Model, camp._id);
      if (pending > 0) {
        await resetStuckQueuedRecipients(Model, camp._id);
        logger.info('Queue Service', `Resuming stuck campaign dispatch: ${camp.title || camp._id}`);
        runCampaignDispatchLoop(camp._id).catch((err) => {
          logger.error('Queue Service', 'Resume dispatch failed', { error: err.message });
        });
        resumed += 1;
      }
    }
  };

  await resumeForModel(Campaign);
  await resumeForModel(MailCampaign);

  return { resumed };
};

/** Wait for in-memory fallback queue to finish (tests / graceful shutdown). */
const drainMemoryQueue = async (timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  while (
    (memoryQueue.length > 0 || isProcessingMemoryQueue || activeDispatchLoops.size > 0)
    && Date.now() < deadline
  ) {
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
  resumeStuckCampaigns,
  runCampaignDispatchLoop,
};
