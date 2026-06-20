/**
 * Admin UI copy for platform settings (stored in MongoDB PlatformSettings).
 * Sections: access | notifications | crm
 */
const PLATFORM_ROLE_FIELDS = [
  {
    key: 'rootAdminUserIds',
    section: 'access',
    label: 'Root administrators',
    description:
      'Protected accounts: cannot be deleted and must stay in the Admin department. Use for platform owners.',
    multiple: true,
  },
  {
    key: 'platformOwnerUserId',
    section: 'access',
    label: 'Platform owner',
    description:
      'Default owner for tech bug projects and internal escalations. One user only.',
    multiple: false,
  },
  {
    key: 'attendanceExcludedUserIds',
    section: 'access',
    label: 'Attendance exclusions',
    description:
      'Excluded from ops attendance grid and morning check-in prompt (in addition to Operations dept and test/demo name patterns).',
    multiple: true,
  },
  {
    key: 'qaExcludedUserIds',
    section: 'access',
    label: 'QA probe exclusions',
    description:
      'No QA notification/email side effects during automated probes. QA agents still run; these users stay quiet.',
    multiple: true,
  },
  {
    key: 'mailTemplateApproverUserIds',
    section: 'access',
    label: 'Mail template approvers',
    description:
      'May approve or reject email templates (in addition to Admin department users).',
    multiple: true,
  },
  {
    key: 'autoProjectMemberUserIds',
    section: 'access',
    label: 'Auto project members',
    description:
      'Automatically added to every new project with Artist Management role.',
    multiple: true,
  },
  {
    key: 'qaAdminUserId',
    section: 'access',
    label: 'QA admin actor',
    description:
      'User ID used by QA CLI scripts (triggerQaHttp, verifyQaCleanup) for JWT auth. One user only.',
    multiple: false,
  },
];

const NOTIFICATION_ROUTING_FIELDS = [
  {
    key: 'crmDigestRecipientUserIds',
    section: 'notifications',
    label: 'CRM daily digest recipients',
    description:
      'Receive the daily call-stats email (artist + sales sections). Replaces CRM_REACH_OUT_DIGEST_EMAIL.',
    multiple: true,
    envFallback: 'CRM_REACH_OUT_DIGEST_EMAIL',
  },
  {
    key: 'backupNotifyUserIds',
    section: 'notifications',
    label: 'Backup alert recipients',
    description:
      'Emailed when daily Mongo backup succeeds or fails. Replaces BACKUP_NOTIFY_EMAIL.',
    multiple: true,
    envFallback: 'BACKUP_NOTIFY_EMAIL',
  },
  {
    key: 'subscriptionReminderFallbackUserIds',
    section: 'notifications',
    label: 'Subscription reminder fallback',
    description:
      'Used when a subscription has no used-by user with an email. Replaces SUBSCRIPTION_REMINDERS_EMAIL.',
    multiple: true,
    envFallback: 'SUBSCRIPTION_REMINDERS_EMAIL',
  },
  {
    key: 'passwordResetCcUserIds',
    section: 'notifications',
    label: 'Password reset CC',
    description:
      'Copied on password-reset emails. Replaces ADMIN_EMAIL for reset CC.',
    multiple: true,
    envFallback: 'ADMIN_EMAIL',
  },
];

const CRM_ROUTING_FIELDS = [
  {
    key: 'primaryCallAssigneeUserId',
    section: 'crm',
    label: 'Artist call rep',
    description:
      'Artist bookings + artist CRM section in daily digest. Replaces PRIMARY_CALL_ASSIGNEE_ID.',
    multiple: false,
    envFallback: 'PRIMARY_CALL_ASSIGNEE_ID',
  },
  {
    key: 'bookedCallSalesRepUserId',
    section: 'crm',
    label: 'Sales call rep (legacy)',
    description:
      'Optional digest-only override. Website book-a-call uses round-robin across all users in the Sales department.',
    multiple: false,
    envFallback: 'BOOKED_CALL_SALES_REP_ID',
  },
];

const PLATFORM_SETTINGS_FIELDS = [
  ...PLATFORM_ROLE_FIELDS,
  ...NOTIFICATION_ROUTING_FIELDS,
  ...CRM_ROUTING_FIELDS,
];

const PLATFORM_SETTINGS_SECTIONS = [
  { id: 'access', label: 'Roles & access' },
  { id: 'notifications', label: 'Email & alerts' },
  { id: 'crm', label: 'CRM routing' },
];

module.exports = {
  PLATFORM_ROLE_FIELDS,
  NOTIFICATION_ROUTING_FIELDS,
  CRM_ROUTING_FIELDS,
  PLATFORM_SETTINGS_FIELDS,
  PLATFORM_SETTINGS_SECTIONS,
};
