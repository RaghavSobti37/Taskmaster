const CONSENT_KEY = 'coreknot_cookie_consent_v1';
const CONSENT_VERSION = 1;

const defaultConsent = () => ({
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  updatedAt: new Date().toISOString(),
});

export function readCookieConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(partial) {
  const next = {
    ...defaultConsent(),
    ...readCookieConsent(),
    ...partial,
    version: CONSENT_VERSION,
    necessary: true,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('coreknot:cookie-consent', { detail: next }));
  return next;
}

export function hasAnalyticsConsent() {
  return Boolean(readCookieConsent()?.analytics);
}

export function acceptAllCookies() {
  return writeCookieConsent({ analytics: true });
}

export function rejectOptionalCookies() {
  return writeCookieConsent({ analytics: false });
}
