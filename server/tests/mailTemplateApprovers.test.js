const { canApproveMailTemplates } = require('../utils/mailTemplateApprovers');
const { hasPageAccess } = require('../utils/pagePermissions');
const { setRuntimePlatformSettings } = require('../../shared/platformUserIds');

describe('mail template approvers', () => {
  const APPROVER_ID = 'cccccccccccccccccccccccc';

  beforeEach(() => {
    setRuntimePlatformSettings({ mailTemplateApproverUserIds: [APPROVER_ID] });
  });

  test('platform settings approver can approve mail templates', () => {
    expect(
      canApproveMailTemplates({ _id: APPROVER_ID, departmentId: { slug: 'sales' } })
    ).toBe(true);
  });

  test('random user cannot approve', () => {
    expect(
      canApproveMailTemplates({ email: 'user@example.com', departmentId: { slug: 'sales' } })
    ).toBe(false);
  });
});

describe('emails page access', () => {
  test('sales preset includes emails via BASE_PAGE_KEYS', () => {
    expect(hasPageAccess({ departmentId: { slug: 'sales', pagePermissions: [] } }, 'emails')).toBe(true);
  });

  test('any authenticated user can access emails (template studio)', () => {
    expect(
      hasPageAccess({ departmentId: { slug: 'sales', pagePermissions: ['dashboard'] } }, 'emails')
    ).toBe(true);
  });

  test('any authenticated user can open campaign detail pages', () => {
    expect(
      hasPageAccess({ departmentId: { slug: 'creative', pagePermissions: ['dashboard'] } }, 'campaigns')
    ).toBe(true);
  });
});
