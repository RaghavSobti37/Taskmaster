import { describe, expect, it } from 'vitest';
import { userSessionChanged } from './AuthContext.jsx';

describe('userSessionChanged', () => {
  it('treats active organization changes as a session change', () => {
    const prev = {
      _id: 'u1',
      name: 'User One',
      tenantId: 'tenant-a',
      activeTenantId: 'tenant-a',
    };
    const next = {
      _id: 'u1',
      name: 'User One',
      tenantId: 'tenant-a',
      activeTenantId: 'tenant-b',
    };

    expect(userSessionChanged(prev, next)).toBe(true);
  });
});
