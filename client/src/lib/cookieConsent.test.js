import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptAllCookies,
  hasAnalyticsConsent,
  readCookieConsent,
  rejectOptionalCookies,
} from './cookieConsent';

const CONSENT_KEY = 'coreknot_cookie_consent_v1';

describe('cookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${CONSENT_KEY}=; path=/; max-age=0`;
    document.cookie = `${CONSENT_KEY}=; path=/; max-age=0; domain=.tsccoreknot.com`;
  });

  afterEach(() => {
    localStorage.clear();
    document.cookie = `${CONSENT_KEY}=; path=/; max-age=0`;
  });

  it('restores analytics consent from shared cookie when localStorage is empty', () => {
    const consent = {
      version: 1,
      necessary: true,
      analytics: true,
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(JSON.stringify(consent))}; path=/`;

    expect(readCookieConsent()?.analytics).toBe(true);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(localStorage.getItem(CONSENT_KEY)).toContain('"analytics":true');
  });

  it('writes consent to cookie and localStorage on accept', () => {
    acceptAllCookies();

    expect(hasAnalyticsConsent()).toBe(true);
    expect(document.cookie).toContain(`${CONSENT_KEY}=`);
    expect(localStorage.getItem(CONSENT_KEY)).toContain('"analytics":true');
  });

  it('persists essential-only choice', () => {
    acceptAllCookies();
    rejectOptionalCookies();

    expect(hasAnalyticsConsent()).toBe(false);
    expect(readCookieConsent()?.analytics).toBe(false);
  });
});
