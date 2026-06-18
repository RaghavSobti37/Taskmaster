const User = require('../models/User');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const {
  getCrmDigestRecipientUserIds,
  getBackupNotifyUserIds,
  getSubscriptionReminderFallbackUserIds,
  getPasswordResetCcUserIds,
} = require('../../shared/platformUserIds');
const { loadPlatformSettings } = require('../services/platformSettingsService');

const BYPASS = bypassOptions('platform-notification-recipients');

const parseEmailList = (raw) => {
  if (!raw) return [];
  return [...new Set(
    String(raw)
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean)
  )];
};

async function resolveEmailsFromUserIds(userIds = []) {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } })
    .select('email')
    .setOptions(BYPASS)
    .lean();
  return [...new Set(users.map((u) => String(u.email || '').trim()).filter(Boolean))];
}

async function resolveRecipientEmails(getUserIds, envKeys = []) {
  await loadPlatformSettings();
  const fromUsers = await resolveEmailsFromUserIds(getUserIds());
  if (fromUsers.length) return fromUsers;
  for (const key of envKeys) {
    const parsed = parseEmailList(process.env[key]);
    if (parsed.length) return parsed;
  }
  return [];
}

const resolveCrmDigestRecipientEmails = () =>
  resolveRecipientEmails(getCrmDigestRecipientUserIds, [
    'CRM_REACH_OUT_DIGEST_EMAIL',
    'ADMIN_EMAIL',
  ]);

const resolveBackupNotifyEmails = () =>
  resolveRecipientEmails(getBackupNotifyUserIds, ['BACKUP_NOTIFY_EMAIL', 'ADMIN_EMAIL']);

const resolveSubscriptionFallbackEmails = () =>
  resolveRecipientEmails(getSubscriptionReminderFallbackUserIds, [
    'SUBSCRIPTION_REMINDERS_EMAIL',
    'ADMIN_EMAIL',
  ]);

const resolvePasswordResetCcEmails = () =>
  resolveRecipientEmails(getPasswordResetCcUserIds, ['ADMIN_EMAIL']);

module.exports = {
  parseEmailList,
  resolveEmailsFromUserIds,
  resolveRecipientEmails,
  resolveCrmDigestRecipientEmails,
  resolveBackupNotifyEmails,
  resolveSubscriptionFallbackEmails,
  resolvePasswordResetCcEmails,
};
