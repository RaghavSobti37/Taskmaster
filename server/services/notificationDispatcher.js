const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendPushToUser } = require('./pushNotificationService');
const { dispatchEmailPayload } = require('../domains/mail/services/mailDriver');

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const templatePath = path.join(__dirname, '../templates/notification.html');
let notificationTemplateHtml = null;

const getNotificationTemplate = () => {
  if (notificationTemplateHtml) return notificationTemplateHtml;
  notificationTemplateHtml = fs.readFileSync(templatePath, 'utf8');
  return notificationTemplateHtml;
};

const buildNotificationHtml = ({ title, message, category, actionUrl, recipientName }) => {
  let html = getNotificationTemplate();
  const appUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  const ctaLink = actionUrl ? (actionUrl.startsWith('http') ? actionUrl : `${appUrl}${actionUrl}`) : `${appUrl}/inbox`;
  html = html
    .replace(/\{\{title\}\}/g, escapeHtml(title))
    .replace(/\{\{message\}\}/g, escapeHtml(message))
    .replace(/\{\{category\}\}/g, escapeHtml(category || 'system'))
    .replace(/\{\{recipientName\}\}/g, escapeHtml(recipientName || 'Team Member'))
    .replace(/\{\{ctaLink\}\}/g, ctaLink)
    .replace(/\{\{timestamp\}\}/g, new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  return html;
};

const sendNotificationEmail = async (user, payload) => {
  if (!user?.email) return false;
  try {
    const html = buildNotificationHtml({ ...payload, recipientName: user.name });
    const from = (
      process.env.SYSTEM_VERIFIED_FROM_EMAIL
      || process.env.SUBSCRIPTION_FROM_EMAIL
      || 'noreply@theshakticollective.in'
    ).trim();
    await dispatchEmailPayload({
      to: user.email,
      subject: payload.title,
      html,
      from,
    });
    return true;
  } catch (err) {
    logger.error('Notification', `Email failed for ${user.email}`, { error: err.message });
    return false;
  }
};

const resolveIconType = ({ iconType, actorId, relatedTaskId, category }) => {
  if (iconType) return iconType;
  if (actorId) return 'user';
  if (relatedTaskId || category === 'task' || category === 'review') return 'task';
  return 'system';
};

const createNotification = async ({
  recipientId,
  title,
  message,
  category = 'system',
  type = 'system',
  relatedLeadId,
  relatedTaskId,
  relatedProjectId,
  actionUrl = '',
  actorId,
  iconType,
  sendEmail = true
}) => {
  const { shouldSuppressNotificationForRecipient } = require('../utils/qaExcludedUsers');
  if (await shouldSuppressNotificationForRecipient(recipientId)) {
    return null;
  }

  const resolvedIconType = resolveIconType({ iconType, actorId, relatedTaskId, category });
  const notificationId = crypto.randomUUID();

  const notification = {
    _id: notificationId,
    recipient: recipientId?.toString?.() || String(recipientId),
    title,
    message,
    type,
    category,
    relatedLeadId: relatedLeadId?.toString?.() || relatedLeadId,
    relatedTaskId: relatedTaskId?.toString?.() || relatedTaskId,
    relatedProjectId: relatedProjectId?.toString?.() || relatedProjectId,
    actionUrl: actionUrl || '',
    actorId: actorId?.toString?.() || actorId,
    iconType: resolvedIconType,
    read: false,
    emailSent: false,
    createdAt: new Date().toISOString(),
  };

  const { broadcastRealtimeEvent } = require('../config/realtime');
  broadcastRealtimeEvent(`user-${recipientId}`, 'notification', notification);

  if (sendEmail) {
    const user = await User.findById(recipientId).select('name email');
    if (user) {
      const sent = await sendNotificationEmail(user, { title, message, category, actionUrl });
      if (sent) notification.emailSent = true;
    }
  }

  await sendPushToUser(recipientId, {
    title,
    body: message,
    actionUrl: actionUrl || '/inbox',
    notificationId,
    category,
    iconType: resolvedIconType
  });

  return notification;
};

module.exports = { createNotification, sendNotificationEmail, buildNotificationHtml };
