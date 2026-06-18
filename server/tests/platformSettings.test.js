const { setRuntimePlatformSettings } = require('../../shared/platformUserIds');
const {
  resolveCrmDigestRecipientEmails,
  parseEmailList,
} = require('../utils/platformNotificationRecipients');
const { canApproveMailTemplates } = require('../utils/mailTemplateApprovers');

describe('platformNotificationRecipients', () => {
  beforeEach(() => {
    setRuntimePlatformSettings({});
    delete process.env.CRM_REACH_OUT_DIGEST_EMAIL;
    delete process.env.ADMIN_EMAIL;
  });

  test('parseEmailList splits comma and semicolon env values', () => {
    expect(parseEmailList('a@x.com,b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(parseEmailList('a@x.com; b@x.com')).toEqual(['a@x.com', 'b@x.com']);
  });

  test('resolveCrmDigestRecipientEmails falls back to env when no user IDs', async () => {
    process.env.CRM_REACH_OUT_DIGEST_EMAIL = 'ops@example.com';
    await expect(resolveCrmDigestRecipientEmails()).resolves.toEqual(['ops@example.com']);
  });
});

describe('mail template approvers via platform settings', () => {
  const APPROVER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

  beforeEach(() => {
    setRuntimePlatformSettings({ mailTemplateApproverUserIds: [APPROVER_ID] });
  });

  test('configured approver user can approve', () => {
    expect(
      canApproveMailTemplates({ _id: APPROVER_ID, departmentId: { slug: 'sales' } })
    ).toBe(true);
  });

  test('random user cannot approve', () => {
    expect(
      canApproveMailTemplates({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', departmentId: { slug: 'sales' } })
    ).toBe(false);
  });
});
