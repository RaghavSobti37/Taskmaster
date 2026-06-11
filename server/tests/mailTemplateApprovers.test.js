const { canApproveMailTemplates } = require('../utils/mailTemplateApprovers');
const { hasPageAccess } = require('../utils/pagePermissions');

describe('mail template approvers', () => {
  test('Harshika can approve mail templates', () => {
    expect(
      canApproveMailTemplates({ email: 'redacted-staff@example.com', departmentId: { slug: 'sales' } })
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

  test('custom pagePermissions without emails denies access', () => {
    expect(
      hasPageAccess({ departmentId: { slug: 'sales', pagePermissions: ['dashboard'] } }, 'emails')
    ).toBe(false);
  });
});
