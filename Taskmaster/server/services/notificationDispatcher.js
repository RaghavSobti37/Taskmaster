const crypto = require('crypto');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { sendPushToUser } = require('./pushNotificationService');
const { getTenantId } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');
const { runWithWorkerTenant } = require('../utils/workerTenantContext');

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
  sendEmail = false
}) => {
  // sendEmail is retained as a no-op parameter for backward compatibility;
  // notification emails have been fully replaced by push notifications.

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
      });
    } catch (err) {
      logger.error('Notification', 'Persist failed', { error: err.message, recipientId });
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

module.exports = { createNotification };
