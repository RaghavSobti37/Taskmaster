const EmailLog = require('../models/EmailLog');

const OPEN_ENGAGED = new Set(['Opened', 'Clicked']);

/** Recipient already counted toward open metrics. */
const isOpenMetricSatisfied = (status) => OPEN_ENGAGED.has(status);

/** Recipient already counted toward click metrics (one click per recipient in campaign stats). */
const isClickMetricSatisfied = (status) => status === 'Clicked';

/**
 * Atomically claim first open for a tracking pixel (race-safe vs prefetch / duplicate loads).
 * @returns {import('mongoose').Document | null} EmailLog when this request won the claim
 */
const claimEmailLogOpen = async (pixelId) =>
  EmailLog.findOneAndUpdate(
    { pixelId, opened: { $ne: true } },
    { $set: { opened: true } },
    { new: false },
  );

/**
 * Atomically claim first click for a tracked link id.
 * @returns {import('mongoose').Document | null}
 */
const claimEmailLogClick = async (clickId) =>
  EmailLog.findOneAndUpdate(
    { clickId, clicked: { $ne: true } },
    { $set: { clicked: true } },
    { new: false },
  );

/** Custom pixel already recorded an open for this send (Resend webhook dedup). */
const hasCustomOpenForRecipient = async (campaignId, leadEmail) => {
  const email = String(leadEmail || '').toLowerCase();
  if (!email || !campaignId) return false;
  const hit = await EmailLog.findOne({
    campaignId: String(campaignId),
    leadEmail: email,
    opened: true,
    pixelId: { $exists: true, $ne: null },
  })
    .select('_id')
    .lean();
  return !!hit;
};

module.exports = {
  claimEmailLogOpen,
  claimEmailLogClick,
  isOpenMetricSatisfied,
  isClickMetricSatisfied,
  hasCustomOpenForRecipient,
};
