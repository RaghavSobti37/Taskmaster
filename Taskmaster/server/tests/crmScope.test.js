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

  it('sales reps browse shared sales pipeline without rep lock', () => {
    expect(resolveCrmScope(salesUser)).toEqual({
      crmType: CRM_TYPES.SALES,
      restrictToOwn: false,
    });

    const query = {};
    applyCrmScopeToQuery(query, salesUser);
    expect(query.assignedRepId).toBeUndefined();
    expect(query.$and).toEqual([{
      $or: [
        { crmType: CRM_TYPES.SALES },
        { crmType: { $exists: false } },
        { crmType: null },
        { crmType: '' },
      ],
    }]);
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
