const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { dispatchEmailPayload } = require('./mailDriver');
const logger = require('../utils/logger');

const REMINDER_DAYS = parseInt(process.env.SUBSCRIPTION_REMINDER_DAYS || '7', 10);

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return startOfDay(d);
};

const formatInr = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const getNotifyEmail = () =>
  (process.env.SUBSCRIPTION_REMINDERS_EMAIL || process.env.ADMIN_EMAIL || '').trim();

const getFromEmail = () => {
  const raw = (process.env.SUBSCRIPTION_FROM_EMAIL || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'noreply@theshakticollective.in').trim();
  if (raw.includes('<') && raw.includes('>')) return raw;
  return `"CoreKnot Subscriptions" <${raw}>`;
};

const buildReminderHtml = (subscription, usedByName) => `
  <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;">
    <h2 style="color:#b45309;">Subscription renewal in ${REMINDER_DAYS} days</h2>
    <p>The following subscription is due soon. Please arrange payment before the due date.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td><strong>Name</strong></td><td>${subscription.name}</td></tr>
      <tr><td><strong>Amount</strong></td><td>${formatInr(subscription.amount)}</td></tr>
      <tr><td><strong>Due date</strong></td><td>${formatDate(subscription.dueDate)}</td></tr>
      <tr><td><strong>Type</strong></td><td>${subscription.type || '—'}</td></tr>
      <tr><td><strong>Periodicity</strong></td><td>${subscription.periodicity || '—'}</td></tr>
      <tr><td><strong>Payment mode</strong></td><td>${subscription.paymentMode || '—'}</td></tr>
      <tr><td><strong>Used by</strong></td><td>${usedByName || '—'}</td></tr>
      ${subscription.notes ? `<tr><td><strong>Notes</strong></td><td>${subscription.notes}</td></tr>` : ''}
    </table>
    <p style="color:#666;font-size:13px;">This is an automated reminder from CoreKnot.</p>
  </div>
`;

const resolveRecipient = async (subscription, fallbackEmail) => {
  if (subscription.usedBy?.email) return subscription.usedBy.email.trim();
  if (subscription.usedBy && mongoose.Types.ObjectId.isValid(subscription.usedBy)) {
    const user = await User.findById(subscription.usedBy).select('email name').setOptions({ bypassTenant: true });
    if (user?.email) return user.email.trim();
  }
  return fallbackEmail;
};

const runSubscriptionReminders = async () => {
  const today = startOfDay(new Date());
  const targetDueDate = addDays(today, REMINDER_DAYS);
  const targetEnd = new Date(targetDueDate);
  targetEnd.setHours(23, 59, 59, 999);

  const fallbackEmail = getNotifyEmail();
  if (!fallbackEmail) {
    logger.warn('SubscriptionReminders', 'No SUBSCRIPTION_REMINDERS_EMAIL or ADMIN_EMAIL configured');
    return { sent: 0, skipped: 0, reason: 'missing_recipient' };
  }

  const dueSoon = await Subscription.find({
    dueDate: { $gte: targetDueDate, $lte: targetEnd },
    $or: [
      { reminderSentForDueDate: { $exists: false } },
      { reminderSentForDueDate: null },
      { $expr: { $ne: ['$reminderSentForDueDate', '$dueDate'] } },
    ],
  })
    .populate('usedBy', 'name email')
    .setOptions({ bypassTenant: true });

  let sent = 0;
  let skipped = 0;

  for (const subscription of dueSoon) {
    const to = await resolveRecipient(subscription, fallbackEmail);
    if (!to) {
      skipped += 1;
      continue;
    }

    const usedByName = subscription.usedBy?.name || subscription.usedBy?.email;
    const subject = `[CoreKnot] Subscription due ${formatDate(subscription.dueDate)} — ${subscription.name}`;
    const html = buildReminderHtml(subscription, usedByName);

    try {
      await dispatchEmailPayload({ to, subject, html, from: getFromEmail() });
      subscription.reminderSentForDueDate = subscription.dueDate;
      await subscription.save();
      sent += 1;
      logger.info('SubscriptionReminders', `Reminder sent for ${subscription.name}`, { to, dueDate: subscription.dueDate });
    } catch (error) {
      skipped += 1;
      logger.error('SubscriptionReminders', `Failed to send reminder for ${subscription.name}`, { error: error.message });
    }
  }

  return { sent, skipped, checked: dueSoon.length, targetDueDate: targetDueDate.toISOString() };
};

module.exports = {
  runSubscriptionReminders,
  REMINDER_DAYS,
  getNotifyEmail,
  getFromEmail,
};
