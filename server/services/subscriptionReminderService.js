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
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#cbd5e1;max-width:640px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:28px;">
    <h2 style="color:#2dd4bf;margin:0 0 12px;font-size:20px;font-weight:600;">Subscription renewal in ${REMINDER_DAYS} days</h2>
    <p style="margin:0 0 16px;line-height:1.6;">The following subscription is due soon. Please arrange payment before the due date.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Name</strong></td><td style="padding:6px 0;color:#f8fafc;">${subscription.name}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Amount</strong></td><td style="padding:6px 0;color:#f8fafc;">${formatInr(subscription.amount)}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Due date</strong></td><td style="padding:6px 0;color:#f8fafc;">${formatDate(subscription.dueDate)}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Type</strong></td><td style="padding:6px 0;color:#f8fafc;">${subscription.type || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Periodicity</strong></td><td style="padding:6px 0;color:#f8fafc;">${subscription.periodicity || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Payment mode</strong></td><td style="padding:6px 0;color:#f8fafc;">${subscription.paymentMode || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;"><strong>Used by</strong></td><td style="padding:6px 0;color:#f8fafc;">${usedByName || '—'}</td></tr>
      ${subscription.notes ? `<tr><td style="padding:6px 0;color:#94a3b8;"><strong>Notes</strong></td><td style="padding:6px 0;color:#f8fafc;">${subscription.notes}</td></tr>` : ''}
    </table>
    <p style="color:#64748b;font-size:13px;margin:0;">This is an automated reminder from CoreKnot.</p>
  </div>
`;

const resolveRecipients = async (subscription, fallbackEmail) => {
  const entries = Array.isArray(subscription.usedBy)
    ? subscription.usedBy
    : subscription.usedBy
      ? [subscription.usedBy]
      : [];

  const emails = [];
  for (const entry of entries) {
    if (entry?.email) {
      emails.push(entry.email.trim());
      continue;
    }
    if (entry && mongoose.Types.ObjectId.isValid(entry)) {
      const user = await User.findById(entry).select('email name').setOptions({ bypassTenant: true });
      if (user?.email) emails.push(user.email.trim());
    }
  }

  const unique = [...new Set(emails.filter(Boolean))];
  if (unique.length) return unique;
  return fallbackEmail ? [fallbackEmail] : [];
};

const formatUsedByNames = (usedBy) => {
  const entries = Array.isArray(usedBy) ? usedBy : usedBy ? [usedBy] : [];
  return entries
    .map((entry) => entry?.name || entry?.email)
    .filter(Boolean)
    .join(', ');
};

const normalizeUsedByOnDoc = (subscription) => {
  if (!subscription) return subscription;
  if (subscription.usedBy != null && !Array.isArray(subscription.usedBy)) {
    subscription.usedBy = [subscription.usedBy];
  }
  return subscription;
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
    normalizeUsedByOnDoc(subscription);
    const recipients = await resolveRecipients(subscription, fallbackEmail);
    if (!recipients.length) {
      skipped += 1;
      continue;
    }

    const usedByName = formatUsedByNames(subscription.usedBy);
    const subject = `[CoreKnot] Subscription due ${formatDate(subscription.dueDate)} — ${subscription.name}`;
    const html = buildReminderHtml(subscription, usedByName);

    try {
      for (const to of recipients) {
        await dispatchEmailPayload({ to, subject, html, from: getFromEmail() });
      }
      subscription.reminderSentForDueDate = subscription.dueDate;
      await subscription.save();
      sent += 1;
      logger.info('SubscriptionReminders', `Reminder sent for ${subscription.name}`, { to: recipients, dueDate: subscription.dueDate });
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
