const CONSENT_KEY = 'coreknot_cookie_consent_v1';
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_SEC = 365 * 24 * 60 * 60;

const defaultConsent = () => ({
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  updatedAt: new Date().toISOString(),
});

/** Share consent across tsccoreknot.com subdomains (app, auth, landing). */
const getSharedCookieDomain = () => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  if (host === 'tsccoreknot.com' || host.endsWith('.tsccoreknot.com')) {
    return '.tsccoreknot.com';
  }
  return '';
};

const parseConsent = (raw) => {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed?.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
};

const readConsentFromLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
};

const readConsentFromCookie = () => {
  if (typeof document === 'undefined') return null;
  const prefix = `${CONSENT_KEY}=`;
  const entry = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return null;
  try {
    return parseConsent(decodeURIComponent(entry.slice(prefix.length)));
  } catch {
    return null;
  }
};

const writeConsentToLocalStorage = (consent) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    /* ignore */
  }
};

const writeConsentToCookie = (consent) => {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(JSON.stringify(consent));
  const parts = [
    `${CONSENT_KEY}=${encoded}`,
    'path=/',
    `max-age=${CONSENT_MAX_AGE_SEC}`,
    'SameSite=Lax',
  ];
  if (window.location.protocol === 'https:') parts.push('Secure');
  const domain = getSharedCookieDomain();
  if (domain) parts.push(`domain=${domain}`);
  document.cookie = parts.join('; ');
};

const pickCanonicalConsent = (localConsent, cookieConsent) => {
  if (!localConsent && !cookieConsent) return null;
  if (!localConsent) return cookieConsent;
  if (!cookieConsent) return localConsent;
  if (localConsent.analytics && !cookieConsent.analytics) return localConsent;
  if (cookieConsent.analytics && !localConsent.analytics) return cookieConsent;
  const localAt = Date.parse(localConsent.updatedAt || '') || 0;
  const cookieAt = Date.parse(cookieConsent.updatedAt || '') || 0;
  return localAt >= cookieAt ? localConsent : cookieConsent;
};

const syncConsentStores = (consent) => {
  if (!consent) return;
  writeConsentToLocalStorage(consent);
  writeConsentToCookie(consent);
};

export function readCookieConsent() {
  const localConsent = readConsentFromLocalStorage();
  const cookieConsent = readConsentFromCookie();
  const canonical = pickCanonicalConsent(localConsent, cookieConsent);
  if (!canonical) return null;

  if (
    JSON.stringify(localConsent) !== JSON.stringify(canonical)
    || JSON.stringify(cookieConsent) !== JSON.stringify(canonical)
  ) {
    syncConsentStores(canonical);
  }

  return canonical;
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
  syncConsentStores(next);
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
