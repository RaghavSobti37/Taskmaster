/**
 * Admin UI copy for platform role assignments (stored in MongoDB PlatformSettings).
 */
const PLATFORM_ROLE_FIELDS = [
  {
    key: 'rootAdminUserIds',
    label: 'Root administrators',
    description:
      'Protected accounts: cannot be deleted and must stay in the Admin department. Use for platform owners.',
    multiple: true,
  },
  {
    key: 'platformOwnerUserId',
    label: 'Platform owner',
    description:
      'Default owner for tech bug projects and internal escalations. One user only.',
    multiple: false,
  },
  {
    key: 'attendanceExcludedUserIds',
    label: 'Attendance exclusions',
    description:
      'Excluded from ops attendance grid and morning check-in prompt (in addition to Operations dept and test/demo name patterns).',
    multiple: true,
  },
  {
    key: 'qaExcludedUserIds',
    label: 'QA probe exclusions',
    description:
      'No QA notification/email side effects during automated probes. QA agents still run; these users stay quiet.',
    multiple: true,
  },
  {
    key: 'mailTemplateApproverUserIds',
    label: 'Mail template approvers',
    description:
      'May approve or reject email templates (in addition to Admin department users).',
    multiple: true,
  },
  {
    key: 'autoProjectMemberUserIds',
    label: 'Auto project members',
    description:
      'Automatically added to every new project with Artist Management role.',
    multiple: true,
  },
  {
    key: 'qaAdminUserId',
    label: 'QA admin actor',
    description:
      'User ID used by QA CLI scripts (triggerQaHttp, verifyQaCleanup) for JWT auth. One user only.',
    multiple: false,
  },
];

module.exports = { PLATFORM_ROLE_FIELDS };
