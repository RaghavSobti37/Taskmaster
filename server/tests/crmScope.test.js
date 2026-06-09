const { resolveCrmScope, applyCrmScopeToQuery } = require('../utils/crmScope');
const { CRM_TYPES } = require('../../shared/artistCrmTaxonomy');

describe('crmScope', () => {
  const artistUser = {
    _id: '507f1f77bcf86cd799439011',
    departmentId: { slug: 'artist-management' },
  };

  const salesUser = {
    _id: '507f1f77bcf86cd799439012',
    departmentId: { slug: 'sales' },
  };

  const adminUser = {
    _id: '507f1f77bcf86cd799439013',
    departmentId: { slug: 'admin', permissionPreset: 'admin' },
  };

  it('artist-management sees all artist CRM leads', () => {
    expect(resolveCrmScope(artistUser)).toEqual({
      crmType: CRM_TYPES.ARTIST,
      restrictToOwn: false,
    });

    const query = {};
    applyCrmScopeToQuery(query, artistUser);
    expect(query).toEqual({ crmType: CRM_TYPES.ARTIST });
    expect(query.assignedRepId).toBeUndefined();
  });

  it('sales reps stay scoped to their own leads', () => {
    expect(resolveCrmScope(salesUser)).toEqual({
      crmType: CRM_TYPES.SALES,
      restrictToOwn: true,
    });

    const query = {};
    applyCrmScopeToQuery(query, salesUser);
    expect(query).toEqual({
      crmType: CRM_TYPES.SALES,
      assignedRepId: salesUser._id,
    });
  });

  it('admin can browse both CRM segments without rep filter', () => {
    expect(resolveCrmScope(adminUser, CRM_TYPES.ARTIST)).toEqual({
      crmType: CRM_TYPES.ARTIST,
      restrictToOwn: false,
    });

    const query = {};
    applyCrmScopeToQuery(query, adminUser, { crmType: CRM_TYPES.ARTIST });
    expect(query).toEqual({ crmType: CRM_TYPES.ARTIST });
  });
});
