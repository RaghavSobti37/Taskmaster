/**
 * Platform user IDs — runtime cache from MongoDB PlatformSettings (admin UI),
 * with env fallback for bootstrap / scripts.
 */
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

let runtime = null;

const parseUserIdList = (raw) => {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((id) => OBJECT_ID_RE.test(id));
};

const userIdInList = (user, ids) => {
  if (!user || !ids.length) return false;
  const uid = String(user._id || user.id || '');
  return ids.includes(uid);
};

const readEnv = (key) => process.env[key] || process.env[`VITE_${key}`];

const envIds = (key) => parseUserIdList(readEnv(key));

const setRuntimePlatformSettings = (next) => {
  runtime = next && typeof next === 'object' ? next : null;
};

const getRuntimePlatformSettings = () => runtime || {};

const idsFor = (runtimeKey, envKey) => {
  const fromDb = runtime?.[runtimeKey];
  if (Array.isArray(fromDb) && fromDb.length) return fromDb.map(String);
  if (typeof fromDb === 'string' && OBJECT_ID_RE.test(fromDb)) return [fromDb];
  return envIds(envKey);
};

const singleIdFor = (runtimeKey, envKey) => {
  const fromDb = runtime?.[runtimeKey];
  if (typeof fromDb === 'string' && OBJECT_ID_RE.test(fromDb)) return fromDb;
  const id = String(readEnv(envKey) || '').trim();
  return OBJECT_ID_RE.test(id) ? id : null;
};

const getRootAdminUserIds = () => idsFor('rootAdminUserIds', 'ROOT_ADMIN_USER_IDS');

const isRootAdminUser = (user) => userIdInList(user, getRootAdminUserIds());

const getPlatformOwnerUserId = () => singleIdFor('platformOwnerUserId', 'PLATFORM_OWNER_USER_ID');

const getAttendanceExcludedUserIds = () =>
  idsFor('attendanceExcludedUserIds', 'ATTENDANCE_EXCLUDED_USER_IDS');

const isAttendanceExcludedByUserId = (user) =>
  userIdInList(user, getAttendanceExcludedUserIds());

const getQaExcludedUserIds = () => idsFor('qaExcludedUserIds', 'QA_EXCLUDED_USER_IDS');

const isQaExcludedUser = (user) => userIdInList(user, getQaExcludedUserIds());

const getMailTemplateApproverUserIds = () =>
  idsFor('mailTemplateApproverUserIds', 'MAIL_TEMPLATE_APPROVER_USER_IDS');

const isMailTemplateApproverUser = (user) =>
  userIdInList(user, getMailTemplateApproverUserIds());

const getAutoProjectMemberUserIds = () =>
  idsFor('autoProjectMemberUserIds', 'AUTO_PROJECT_MEMBER_USER_IDS');

const getQaAdminUserId = () => singleIdFor('qaAdminUserId', 'QA_ADMIN_USER_ID');

const getBackupNotifyUserIds = () => idsFor('backupNotifyUserIds', 'BACKUP_NOTIFY_USER_IDS');

const getSubscriptionReminderFallbackUserIds = () =>
  idsFor('subscriptionReminderFallbackUserIds', 'SUBSCRIPTION_REMINDER_FALLBACK_USER_IDS');

const getPasswordResetCcUserIds = () => idsFor('passwordResetCcUserIds', 'PASSWORD_RESET_CC_USER_IDS');

const getPrimaryCallAssigneeUserId = () =>
  singleIdFor('primaryCallAssigneeUserId', 'PRIMARY_CALL_ASSIGNEE_ID');

const getBookedCallSalesRepUserId = () =>
  singleIdFor('bookedCallSalesRepUserId', 'BOOKED_CALL_SALES_REP_ID');

module.exports = {
  OBJECT_ID_RE,
  parseUserIdList,
  userIdInList,
  setRuntimePlatformSettings,
  getRuntimePlatformSettings,
  getRootAdminUserIds,
  isRootAdminUser,
  getPlatformOwnerUserId,
  getAttendanceExcludedUserIds,
  isAttendanceExcludedByUserId,
  getQaExcludedUserIds,
  isQaExcludedUser,
  getMailTemplateApproverUserIds,
  isMailTemplateApproverUser,
  getAutoProjectMemberUserIds,
  getQaAdminUserId,
  getBackupNotifyUserIds,
  getSubscriptionReminderFallbackUserIds,
  getPasswordResetCcUserIds,
  getPrimaryCallAssigneeUserId,
  getBookedCallSalesRepUserId,
};
