import { getDepartmentSlug, isAdminUser, ARTIST_SLUG } from './departmentPermissions';

export const CRM_TYPES = {
  SALES: 'sales',
  ARTIST: 'artist',
};

/** Artist-management dept users (not sales/admin) see artist CRM segment. */
export function isArtistOnlyCrmUser(user) {
  if (!user || isAdminUser(user)) return false;
  const slug = getDepartmentSlug(user);
  return slug === ARTIST_SLUG;
}

/** Artist CRM rep dropdown + labels (list mode or open lead). */
export function isArtistCrmContext(user, lead = null) {
  if (isArtistOnlyCrmUser(user)) return true;
  return lead?.crmType === CRM_TYPES.ARTIST;
}

export function resolveClientCrmType(user) {
  if (isArtistOnlyCrmUser(user)) return CRM_TYPES.ARTIST;
  return CRM_TYPES.SALES;
}

/** CRM list/follow-up pages share team pipelines; filters narrow results. */
export function crmRestrictsToOwnLeads() {
  return false;
}

export function crmQueryParamsForUser(user, extra = {}) {
  const crmType = extra.crmType || resolveClientCrmType(user);
  if (isAdminUser(user) && !extra.crmType) {
    return { ...extra };
  }
  return { ...extra, crmType };
}
