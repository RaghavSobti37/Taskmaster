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
  test('any authenticated user can access emails page', () => {
    expect(hasPageAccess({ departmentId: { slug: 'sales', pagePermissions: [] } }, 'emails')).toBe(true);
  });
});
