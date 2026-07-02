const { canAccessResource, RESOURCE_PAGE_MAP } = require('../utils/canAccessResource');

describe('canAccessResource', () => {
  const salesUser = {
    departmentId: { slug: 'sales', permissionPreset: 'sales' },
    pagePermissions: [],
  };
  const adminUser = {
    departmentId: { slug: 'admin', permissionPreset: 'admin' },
    pagePermissions: [],
  };

  it('maps resource types to page keys', () => {
    expect(RESOURCE_PAGE_MAP.Project).toBe('projects');
    expect(RESOURCE_PAGE_MAP.Finance).toBe('finance');
  });

  it('admin bypasses resource check', () => {
    expect(canAccessResource(adminUser, 'Finance', 'id')).toBe(true);
  });

  it('denies finance without page access', () => {
    expect(canAccessResource(salesUser, 'Finance', 'id')).toBe(false);
  });

  it('allows owner override', () => {
    const restricted = {
      departmentId: { slug: 'sales', permissionPreset: 'sales' },
      pagePermissions: ['leads', 'followups'],
    };
    expect(canAccessResource(restricted, 'Project', 'id', { isOwner: true })).toBe(false);
    const creative = {
      departmentId: { slug: 'creative', permissionPreset: 'creative' },
      pagePermissions: ['projects'],
    };
    expect(canAccessResource(creative, 'Project', 'id', { isOwner: true })).toBe(true);
  });
});
