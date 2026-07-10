/**
 * Universal static brand icon paths.
 * All PNGs/ICO are generated from public/brand-mark.svg (npm run generate-icons).
 * Do not point UI or meta tags at legacy favicon.svg (purple mark).
 */

const BRAND_THEME_COLOR = '#126d5e';

/** Canonical vector mark — favicon, PWA fallback */
const BRAND_MARK_SVG = '/brand-mark.svg';

/** Raster + platform-specific assets under /icons/ */
export const BRAND_ICONS = {
  favicon16: '/icons/favicon-16.png',
  favicon32: '/icons/favicon-32.png',
  favicon48: '/icons/favicon-48.png',
  faviconIco: '/favicon.ico',
  appleTouch120: '/icons/apple-touch-icon-120.png',
  appleTouch152: '/icons/apple-touch-icon-152.png',
  appleTouch167: '/icons/apple-touch-icon-167.png',
  appleTouch180: '/icons/apple-touch-icon.png',
  pwa96: '/icons/icon-96.png',
  pwa192: '/icons/icon-192.png',
  pwa512: '/icons/icon-512.png',
  maskable512: '/icons/icon-maskable-512.png',
  mstile150: '/icons/mstile-150x150.png',
  og512: '/icons/og-image.png',
  /** OS notifications, push, badges — 192px harmonic mark */
  notification: '/icons/icon-192.png',
};

const SAFARI_PINNED_TAB_SVG = '/safari-pinned-tab.svg';

/** @param {string} [origin] */
export const resolveBrandIconUrl = (path, origin) => {
  if (origin && path.startsWith('/')) {
    return `${origin.replace(/\/$/, '')}${path}`;
  }
  return path;
};

export const getNotificationIconUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return resolveBrandIconUrl(BRAND_ICONS.notification, window.location.origin);
  }
  return BRAND_ICONS.notification;
};

/** Service worker / push — same asset as in-app notifications */
const NOTIFICATION_ICON_PATH = BRAND_ICONS.notification;
