import { isAuthSite, isLandingSite } from '../config/siteMode';

const PUBLIC_PATH_PREFIXES = [
  '/landing',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/relegends',
  '/privacy',
  '/userdata',
];

/** Normalize pathname for route checks (no trailing slash except root). */
export function normalizePathname(pathname = '/') {
  const base = String(pathname || '/').split('?')[0].split('#')[0] || '/';
  if (base !== '/' && base.endsWith('/')) return base.slice(0, -1);
  return base || '/';
}

/** Login, landing, auth, and legal marketing routes — follow OS color scheme only. */
export function isPublicThemeRoute(pathname) {
  const path = normalizePathname(pathname);

  if (PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }

  if (path === '/' && (isLandingSite() || isAuthSite())) {
    return true;
  }

  return false;
}

export function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveStoredThemePreference(stored) {
  if (stored === 'system' || !stored) {
    return getSystemTheme();
  }
  return stored === 'dark' ? 'dark' : 'light';
}

export function applyDocumentTheme(resolved) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved === 'dark' ? 'dark' : 'light');
}

/** Earliest JS theme bootstrap — public routes use system; app routes use saved preference. */
export function bootstrapDocumentTheme(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const publicRoute = isPublicThemeRoute(pathname);
    const resolved = publicRoute
      ? getSystemTheme()
      : resolveStoredThemePreference(window.localStorage.getItem('theme'));
    applyDocumentTheme(resolved);
  } catch {
    // ponytail: localStorage / matchMedia may throw in restricted contexts
  }
}
