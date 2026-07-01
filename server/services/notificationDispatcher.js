const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { sendPushToUser } = require('./pushNotificationService');
const { dispatchEmailPayload } = require('../domains/mail/services/mailDriver');
const { getTenantId } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');
const { runWithWorkerTenant } = require('../utils/workerTenantContext');

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

/** Cron/webhooks lack request tenant — derive from recipient so production validate() passes. */
const resolveRecipientTenantId = async (recipientId) => {
  const fromContext = getTenantId();
  if (fromContext) return fromContext;

  const recipient = await User.findById(recipientId)
    .select('tenantId')
    .setOptions({ bypassTenant: true })
    .lean();
  if (recipient?.tenantId) return recipient.tenantId;

  return resolveDefaultTenantId();
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

  let tenantId;
  try {
    tenantId = await resolveRecipientTenantId(recipientId);
  } catch (err) {
    logger.error('Notification', 'Tenant resolve failed', { error: err.message, recipientId });
    return notification;
  }

  const deliver = async () => {
    try {
      await Notification.create({
        _id: notificationId,
        recipient: recipientId,
        title,
        message,
        type,
        category,
        relatedLeadId: relatedLeadId || undefined,
        relatedTaskId: relatedTaskId || undefined,
        relatedProjectId: relatedProjectId || undefined,
        actionUrl: actionUrl || '',
        actorId: actorId || undefined,
        iconType: resolvedIconType,
        read: false,
        emailSent: false,
      });
    } catch (err) {
      logger.error('Notification', 'Persist failed', { error: err.message, recipientId });
    }

    if (sendEmail) {
      const user = await User.findById(recipientId)
        .select('name email')
        .setOptions({ bypassTenant: true });
      if (user) {
        const sent = await sendNotificationEmail(user, { title, message, category, actionUrl });
        if (sent) {
          notification.emailSent = true;
          Notification.updateOne({ _id: notificationId }, { emailSent: true })
            .setOptions({ bypassTenant: true })
            .catch(() => {});
        }
      }
    }

    await sendPushToUser(recipientId, {
      title,
      body: message,
      actionUrl: actionUrl || '/inbox',
      notificationId,
      category,
      iconType: resolvedIconType,
    });

    return notification;
  };

  return runWithWorkerTenant(tenantId, () => deliver());
};

module.exports = { createNotification, sendNotificationEmail, buildNotificationHtml };
