import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getClerkDashboardUrl,
  getClerkProxyUrl,
  getPinnedClerkOrganizationId,
  isClerkConfigured,
  isClerkDashboardReady,
  isClerkLiveKey,
  isLocalClerkRuntime,
} from './clerk';

describe('clerk config', () => {
  const env = import.meta.env;

  beforeEach(() => {
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = '';
    env.VITE_CLERK_DASHBOARD_URL = '';
    env.VITE_CLERK_DASHBOARD_APP_PATH = '';
    env.VITE_CLERK_PROXY_URL = '';
    env.VITE_APP_URL = '';
    env.VITE_CLERK_ORGANIZATION_ID = '';
    env.NEXT_PUBLIC_CLERK_ORGANIZATION_ID = '';
  });

  afterEach(() => {
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = '';
    env.VITE_CLERK_DASHBOARD_URL = '';
    env.VITE_CLERK_DASHBOARD_APP_PATH = '';
    env.VITE_CLERK_PROXY_URL = '';
    env.VITE_APP_URL = '';
    env.VITE_CLERK_ORGANIZATION_ID = '';
    env.NEXT_PUBLIC_CLERK_ORGANIZATION_ID = '';
  });

  it('isClerkConfigured is false without publishable key', () => {
    expect(isClerkConfigured()).toBe(false);
  });

  it('isClerkConfigured is true with real-looking key', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    expect(isClerkConfigured()).toBe(true);
  });

  it('isClerkConfigured is true with NEXT_PUBLIC alias', () => {
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    expect(isClerkConfigured()).toBe(true);
  });

  it('builds last-active dashboard deep links', () => {
    expect(getClerkDashboardUrl()).toBe('https://dashboard.clerk.com/last-active');
    expect(getClerkDashboardUrl('users')).toBe('https://dashboard.clerk.com/last-active?path=users');
    expect(getClerkDashboardUrl('~/api-keys')).toBe('https://dashboard.clerk.com/~/api-keys');
  });

  it('supports legacy apps/app_ path override', () => {
    env.VITE_CLERK_DASHBOARD_APP_PATH = 'apps/app_test';
    expect(getClerkDashboardUrl()).toBe('https://dashboard.clerk.com/apps/app_test');
    expect(getClerkDashboardUrl('users')).toBe('https://dashboard.clerk.com/apps/app_test/users');
  });

  it('isClerkDashboardReady is true with default host', () => {
    expect(isClerkDashboardReady()).toBe(true);
  });

  it('returns empty pinned organization id when unset', () => {
    expect(getPinnedClerkOrganizationId()).toBe('');
  });

  it('uses registered primary proxy on auth site (OAuth cookies must match redirect_uri)', () => {
    const wasDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_SITE_MODE = 'auth';
    env.VITE_AUTH_URL = 'https://auth.tsccoreknot.com';
    env.VITE_CLERK_PROXY_URL = 'https://tsccoreknot.com/__clerk';
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
    env.VITE_SITE_MODE = 'landing';
    env.VITE_LANDING_URL = 'https://landing.tsccoreknot.com';
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
    env.VITE_SITE_MODE = 'app';
    import.meta.env.DEV = wasDev;
  });

  it('rewrites stale auth/landing VITE_CLERK_PROXY_URL to primary (fixes authorization_invalid)', async () => {
    const { resolveClerkProxyUrl } = await import('./clerk.js');
    expect(resolveClerkProxyUrl(
      'https://auth.tsccoreknot.com/__clerk',
      'https://tsccoreknot.com/__clerk',
    )).toBe('https://tsccoreknot.com/__clerk');
    expect(resolveClerkProxyUrl(
      'https://landing.tsccoreknot.com/__clerk',
      'https://tsccoreknot.com/__clerk',
    )).toBe('https://tsccoreknot.com/__clerk');
    expect(resolveClerkProxyUrl(
      'https://tsccoreknot.com/__clerk',
      'https://tsccoreknot.com/__clerk',
    )).toBe('https://tsccoreknot.com/__clerk');
  });

  it('falls back to app origin /__clerk when auth site has no explicit proxy env', () => {
    const wasDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_SITE_MODE = 'auth';
    env.VITE_AUTH_URL = 'https://auth.tsccoreknot.com';
    env.VITE_APP_URL = 'https://tsccoreknot.com';
    env.VITE_CLERK_PROXY_URL = '';
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
    // Stale baked env on auth builds
    env.VITE_CLERK_PROXY_URL = 'https://auth.tsccoreknot.com/__clerk';
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
    env.VITE_SITE_MODE = 'app';
    import.meta.env.DEV = wasDev;
  });

  it('uses primary app proxy for live keys on app site', () => {
    const wasDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_APP_URL = 'https://tsccoreknot.com';
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
    import.meta.env.DEV = wasDev;
  });

  it('respects explicit proxy URL override', () => {
    const wasDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_CLERK_PROXY_URL = 'https://auth.example.com/__clerk';
    expect(getClerkProxyUrl()).toBe('https://auth.example.com/__clerk');
    import.meta.env.DEV = wasDev;
  });

  it('skips proxy for test keys', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    expect(getClerkProxyUrl()).toBe('');
    expect(isClerkLiveKey()).toBe(false);
  });

  it('skips proxy on local runtime even for live keys', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_APP_URL = 'https://tsccoreknot.com';
    const wasDev = import.meta.env.DEV;
    import.meta.env.DEV = true;
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(isLocalClerkRuntime()).toBe(true);
    expect(getClerkProxyUrl()).toBe('');
    import.meta.env.DEV = wasDev;
  });

  it('uses proxy on production host for live keys', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_APP_URL = 'https://tsccoreknot.com';
    const wasDev = import.meta.env.DEV;
    import.meta.env.DEV = true;
    vi.stubGlobal('window', { location: { hostname: 'tsccoreknot.com' } });
    expect(isLocalClerkRuntime()).toBe(false);
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
    import.meta.env.DEV = wasDev;
  });
});
