import { describe, it, expect } from 'vitest';
import { getOrgRoleDeleteBlockReason } from './adminRoleDelete';

describe('getOrgRoleDeleteBlockReason', () => {
  it('allows delete for custom roles with no users assigned', () => {
    expect(getOrgRoleDeleteBlockReason({ name: 'Custom QA', slug: 'custom-qa', memberCount: 0 })).toBeNull();
    expect(getOrgRoleDeleteBlockReason({ name: 'Custom QA', slug: 'custom-qa' })).toBeNull();
  });

  it('blocks when users are assigned', () => {
    expect(getOrgRoleDeleteBlockReason({ name: 'Sales', slug: 'sales-custom', memberCount: 1 })).toMatch(/1 user is still assigned/i);
    expect(getOrgRoleDeleteBlockReason({ name: 'Sales', slug: 'sales-custom', memberCount: 3 })).toMatch(/3 users are still assigned/i);
  });

  it('blocks system roles', () => {
    expect(getOrgRoleDeleteBlockReason({ name: 'Sales', slug: 'sales', isSystem: true })).toMatch(/system role/i);
    expect(getOrgRoleDeleteBlockReason({ name: 'Operations', slug: 'ops', isSystem: true, memberCount: 0 })).toMatch(/system role/i);
  });

  it('blocks admin roles', () => {
    expect(getOrgRoleDeleteBlockReason({ name: 'Admin', slug: 'admin', isSystem: true })).toMatch(/system role/i);
    expect(getOrgRoleDeleteBlockReason({
      name: 'Backup Admin',
      slug: 'backup-admin',
      permissionPreset: 'admin',
      isSystem: false,
    })).toMatch(/admin role/i);
  });
});
