const { setRuntimePlatformSettings } = require('../../shared/platformUserIds');
const { parseEmailList } = require('../utils/platformNotificationRecipients');
const { canApproveMailTemplates } = require('../utils/mailTemplateApprovers');

describe('platformNotificationRecipients', () => {
  beforeEach(() => {
    setRuntimePlatformSettings({});
    delete process.env.ADMIN_EMAIL;
  });

  test('parseEmailList splits comma and semicolon env values', () => {
    expect(parseEmailList('a@x.com,b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(parseEmailList('a@x.com; b@x.com')).toEqual(['a@x.com', 'b@x.com']);
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
