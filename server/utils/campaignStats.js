const mongoose = require('mongoose');

const EMPTY_STATUS_COUNTS = () => ({
  Pending: 0,
  Queued: 0,
  Sent: 0,
  Opened: 0,
  Clicked: 0,
  Bounced: 0,
  Failed: 0,
  Invalid: 0,
  Unsubscribed: 0,
  Cancelled: 0,
});

const buildStatsFromCounts = (recipientStatusCounts, total) => {
  const delivered =
    recipientStatusCounts.Sent + recipientStatusCounts.Opened + recipientStatusCounts.Clicked;
  const opened = recipientStatusCounts.Opened + recipientStatusCounts.Clicked;
  const clicked = recipientStatusCounts.Clicked;
  const failed = recipientStatusCounts.Failed;
  const bounced =
    recipientStatusCounts.Bounced + recipientStatusCounts.Failed + recipientStatusCounts.Invalid;
  const unsubscribed = recipientStatusCounts.Unsubscribed;
  const invalid = recipientStatusCounts.Invalid;
  const pending = recipientStatusCounts.Pending + recipientStatusCounts.Queued;

  return {
    total,
    recipientStatusCounts,
    stats: { total, sent: delivered, opened, clicked, bounced, failed, unsubscribed, invalid, pending },
    metrics: {
      totalSent: delivered,
      opened,
      clicked,
      bounced,
      failed,
      unsubscribed,
    },
  };
};

/** Derive campaign delivery metrics from recipient status rows (source of truth). */
const computeRecipientStats = (recipients = []) => {
  const recipientStatusCounts = EMPTY_STATUS_COUNTS();
  (recipients || []).forEach((r) => {
    const st = r.status || 'Pending';
    if (recipientStatusCounts[st] !== undefined) recipientStatusCounts[st]++;
    else recipientStatusCounts.Pending++;
  });

  const total = recipients?.length || 0;
  return buildStatsFromCounts(recipientStatusCounts, total);
};

/** Aggregate recipient status counts without loading the full recipients array. */
const aggregateRecipientStats = async (Model, campaignId) => {
  const rows = await Model.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(campaignId)) } },
    { $unwind: '$recipients' },
    {
      $group: {
        _id: { $ifNull: ['$recipients.status', 'Pending'] },
        count: { $sum: 1 },
      },
    },
  ]);

  const recipientStatusCounts = EMPTY_STATUS_COUNTS();
  let total = 0;
  for (const row of rows) {
    const status = row._id || 'Pending';
    const count = row.count || 0;
    total += count;
    if (recipientStatusCounts[status] !== undefined) recipientStatusCounts[status] += count;
    else recipientStatusCounts.Pending += count;
  }

  return buildStatsFromCounts(recipientStatusCounts, total);
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

module.exports = {
  computeRecipientStats,
  aggregateRecipientStats,
  countPendingRecipients,
};
