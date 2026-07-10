/** Mobile support tiers for route gating */
export const MOBILE_PAGE_LEVEL = {
  FULL: 'full',
  LIMITED: 'limited',
  /** @deprecated Never returned — kept for imports; use LIMITED + banner instead */
  DESKTOP: 'desktop',
};

/**
 * Resolve mobile support for current route.
 * All authenticated app routes render on mobile; page scroll handles overflow.
 * @param {string} [_pathname]
 * @param {string} [_search]
 */
export function getMobilePageSupport(_pathname, _search = '') {
  return { level: MOBILE_PAGE_LEVEL.FULL, autoBanner: false };
}

/** Whether route should show auto-injected mobile banner */
export function shouldShowMobileBanner(_pathname, _search = '') {
  return false;
}

/** Sidebar: all nav entries reachable on mobile */
export function isNavDesktopOnly(_path) {
  return false;
}

/** Mobile-friendly pages for bottom nav / quick links */
export const MOBILE_PRIMARY_PATHS = [
  '/dashboard',
  '/todo',
  '/projects',
  '/attendance',
  '/inbox',
  '/notes',
];
