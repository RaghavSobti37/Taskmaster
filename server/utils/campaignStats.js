/** Derive campaign delivery metrics from recipient status rows (source of truth). */
const computeRecipientStats = (recipients = []) => {
  const recipientStatusCounts = {
    Pending: 0,
    Queued: 0,
    Sent: 0,
    Opened: 0,
    Clicked: 0,
    Bounced: 0,
    Failed: 0,
    Invalid: 0,
    Unsubscribed: 0,
  };

  (recipients || []).forEach((r) => {
    const st = r.status || 'Pending';
    if (recipientStatusCounts[st] !== undefined) recipientStatusCounts[st]++;
    else recipientStatusCounts.Pending++;
  });

  const total = recipients?.length || 0;
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

module.exports = { computeRecipientStats };
