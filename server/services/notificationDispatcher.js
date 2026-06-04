const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendPushToUser } = require('./pushNotificationService');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS || 'placeholder@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'placeholder_pass'
  }
});

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
  if (!user?.email || process.env.EMAIL_ADDRESS === 'placeholder@gmail.com') return false;
  try {
    const html = buildNotificationHtml({ ...payload, recipientName: user.name });
    await transporter.sendMail({
      from: process.env.EMAIL_ADDRESS,
      to: user.email,
      subject: payload.title,
      text: payload.message,
      html
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

  const notification = await Notification.create({
    recipient: recipientId,
    title,
    message,
    type,
    category,
    relatedLeadId,
    relatedTaskId,
    relatedProjectId,
    actionUrl,
    actorId,
    iconType: resolvedIconType
  });

  if (sendEmail) {
    const user = await User.findById(recipientId).select('name email');
    if (user) {
      const sent = await sendNotificationEmail(user, { title, message, category, actionUrl });
      if (sent) {
        notification.emailSent = true;
        await notification.save();
      }
    }
  }

  await sendPushToUser(recipientId, {
    title,
    body: message,
    actionUrl: actionUrl || '/inbox',
    notificationId: notification._id.toString(),
    category,
    iconType: resolvedIconType
  });

  return notification;
};

module.exports = { createNotification, sendNotificationEmail, buildNotificationHtml };
