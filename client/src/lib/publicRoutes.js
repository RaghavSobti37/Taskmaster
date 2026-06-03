/** Paths that should render without waiting for /api/auth/me bootstrap. */
export const PUBLIC_ROUTE_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/relegends',
  '/privacy',
  '/userdata',
  '/unsubscribe',
]);

export function isPublicAppPath(pathname) {
  if (!pathname) return false;
  if (PUBLIC_ROUTE_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/auth/') || pathname.startsWith('/oauth/')) return true;
  if (pathname.startsWith('/preview/')) return true;
  return false;
}
