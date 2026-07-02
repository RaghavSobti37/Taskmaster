/**
 * Resource-level access helper — extend beyond page-key presets.
 * Phase 7 spike: projects + finance first.
 */
const { hasPageAccess } = require('./pagePermissions');
const { isAdminUser } = require('./departmentPermissions');

const RESOURCE_PAGE_MAP = {
  Project: 'projects',
  Finance: 'finance',
  Lead: 'leads',
};

/**
 * @param {object} user
 * @param {'Project'|'Finance'|'Lead'} resourceType
 * @param {string|object} resource — id or doc with assignee/owner fields
 * @param {object} [opts]
 * @param {boolean} [opts.isOwner] — caller computed ownership
 */
function canAccessResource(user, resourceType, resource, opts = {}) {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const pageKey = RESOURCE_PAGE_MAP[resourceType];
  if (pageKey && !hasPageAccess(user, pageKey)) return false;

  if (opts.isOwner === true) return true;

  // ponytail: IDOR checks stay in route controllers until CASL migration
  return Boolean(pageKey && hasPageAccess(user, pageKey));
}

module.exports = {
  canAccessResource,
  RESOURCE_PAGE_MAP,
};
