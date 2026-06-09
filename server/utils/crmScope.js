const { CRM_TYPES } = require('../../shared/artistCrmTaxonomy');
const { isAdminUser, getDepartmentSlug, SALES_SLUG, ARTIST_SLUG } = require('./departmentPermissions');

/**
 * Resolve CRM segment filter for the current user.
 * @returns {{ crmType: string|null, restrictToOwn: boolean }}
 */
function resolveCrmScope(user, queryCrmType) {
  if (isAdminUser(user)) {
    const crmType = queryCrmType === CRM_TYPES.ARTIST || queryCrmType === CRM_TYPES.SALES
      ? queryCrmType
      : null;
    return { crmType, restrictToOwn: false };
  }

  const slug = getDepartmentSlug(user);
  if (slug === ARTIST_SLUG) {
    // Whole artist-management team shares one pipeline; assignment stays on primary rep.
    return { crmType: CRM_TYPES.ARTIST, restrictToOwn: false };
  }
  if (slug === SALES_SLUG) {
    return { crmType: CRM_TYPES.SALES, restrictToOwn: true };
  }

  // Custom page permissions: infer from explicit query if CRM access granted
  const requested = queryCrmType === CRM_TYPES.ARTIST || queryCrmType === CRM_TYPES.SALES
    ? queryCrmType
    : CRM_TYPES.SALES;
  return { crmType: requested, restrictToOwn: true };
}

/** Apply crmType + optional rep scoping to a Mongo query object. */
function applyCrmScopeToQuery(query, user, reqQuery = {}) {
  const { crmType, restrictToOwn } = resolveCrmScope(user, reqQuery.crmType);

  if (crmType) {
    query.crmType = crmType;
  } else if (reqQuery.crmType === CRM_TYPES.ARTIST || reqQuery.crmType === CRM_TYPES.SALES) {
    query.crmType = reqQuery.crmType;
  }

  if (restrictToOwn && user?._id) {
    query.assignedRepId = user._id;
  }

  return query;
}

module.exports = {
  resolveCrmScope,
  applyCrmScopeToQuery,
};
