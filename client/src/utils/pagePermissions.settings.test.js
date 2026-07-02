import { describe, it, expect } from 'vitest';
import { hasPageAccess } from './pagePermissions';

describe('hasPageAccess — settings', () => {
  it('allows settings for any authenticated user even when pagePermissions omit settings', () => {
    const user = {
      _id: 'u1',
      pagePermissions: ['dashboard', 'todo'],
      departmentId: { slug: 'sales', permissionPreset: 'sales' },
    };

    expect(hasPageAccess(user, 'settings')).toBe(true);
  });

  it('denies settings when user is missing', () => {
    expect(hasPageAccess(null, 'settings')).toBe(false);
  });
});
