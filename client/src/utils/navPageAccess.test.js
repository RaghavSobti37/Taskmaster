import { describe, it, expect } from 'vitest';

import {

  canAccessNavPath,

  filterActionsByPageAccess,

  filterQuickActionsByPageAccess,

  resolveNavAccessKey,

  NAV_PATH_ACCESS,
  getNavFeatureLock,

} from './navPageAccess';

import { hasPageAccess, hasAnyPageAccess } from './pagePermissions';



const salesUser = {

  _id: 'u1',

  departmentId: {

    slug: 'sales',

    permissionPreset: 'sales',

    pagePermissions: [],

  },

};



describe('navPageAccess', () => {

  it('maps tool pages in NAV_PATH_ACCESS', () => {

    expect(NAV_PATH_ACCESS['/office-assets']).toBe('office_assets');

    expect(NAV_PATH_ACCESS['/features']).toBe('features');

    expect(NAV_PATH_ACCESS['/workflows']).toBe('workflows');

    expect(NAV_PATH_ACCESS['/settings']).toBe('settings');
    expect(NAV_PATH_ACCESS['/developers']).toBe('admin_developers');

    expect(NAV_PATH_ACCESS['/admin/artist-path']).toBe('admin_artist_path');

    expect(NAV_PATH_ACCESS['/admin/teams']).toBe('admin_teams');

  });



  it('resolves nested paths via prefix', () => {

    expect(resolveNavAccessKey('/projects/abc123')).toBe('projects');

    expect(resolveNavAccessKey('/campaign/foo')).toBe('campaigns');
    expect(resolveNavAccessKey('/developers')).toBe('admin_developers');

    expect(resolveNavAccessKey('/unknown-page')).toBeNull();

  });



  it('denies finance path for sales user', () => {

    expect(canAccessNavPath(salesUser, '/finance', hasPageAccess, hasAnyPageAccess)).toBe(false);

  });



  it('denies unmapped paths (fail-closed)', () => {

    expect(canAccessNavPath(salesUser, '/mystery-route', hasPageAccess, hasAnyPageAccess)).toBe(false);

  });



  it('allows CRM hub for sales user', () => {

    expect(canAccessNavPath(salesUser, '/crm', hasPageAccess, hasAnyPageAccess)).toBe(true);

  });



  it('filterActionsByPageAccess removes gated nav actions', () => {

    const actions = [

      { id: 'finance', path: '/finance', label: 'Finance' },

      { id: 'crm', path: '/crm', label: 'CRM' },

      { id: 'quick', label: 'Quick add' },

    ];

    const filtered = filterActionsByPageAccess(actions, salesUser);

    expect(filtered.map((a) => a.id)).toEqual(['crm', 'quick']);

  });



  it('filterQuickActionsByPageAccess gates log action without logs page', () => {

    const notesOnlyUser = {

      departmentId: { slug: 'sales', permissionPreset: 'sales', pagePermissions: ['dashboard', 'notes'] },

    };

    const actions = [

      { id: 'quick-log', quickActionId: 'log', label: 'Add Daily Log' },

      { id: 'quick-note', quickActionId: 'note', label: 'Add Note' },

    ];

    const filtered = filterQuickActionsByPageAccess(actions, notesOnlyUser);

    expect(filtered.map((a) => a.id)).toEqual(['quick-note']);

  });

  it('does not lock nav items when paywalls are removed', () => {
    expect(getNavFeatureLock('/finance', { finance: false }, {
      finance: { code: 'PLAN_UPGRADE_REQUIRED' },
    })).toBeNull();
  });

});

