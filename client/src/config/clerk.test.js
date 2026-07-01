import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getClerkDashboardUrl,
  getClerkProxyUrl,
  getPinnedClerkOrganizationId,
  isClerkConfigured,
  isClerkDashboardReady,
  isClerkLiveKey,
} from './clerk';

describe('clerk config', () => {
  const env = import.meta.env;

  beforeEach(() => {
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.VITE_CLERK_DASHBOARD_URL = '';
    env.VITE_CLERK_DASHBOARD_APP_PATH = '';
    env.VITE_CLERK_PROXY_URL = '';
    env.VITE_APP_URL = '';
  });

  afterEach(() => {
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.VITE_CLERK_DASHBOARD_URL = '';
    env.VITE_CLERK_DASHBOARD_APP_PATH = '';
    env.VITE_CLERK_PROXY_URL = '';
    env.VITE_APP_URL = '';
  });

  it('isClerkConfigured is false without publishable key', () => {
    expect(isClerkConfigured()).toBe(false);
  });

  it('isClerkConfigured is true with real-looking key', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
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

  it('uses auth origin proxy on auth site (CSP same-origin)', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_SITE_MODE = 'auth';
    env.VITE_AUTH_URL = 'https://auth.tsccoreknot.com';
    env.VITE_CLERK_PROXY_URL = 'https://tsccoreknot.com/__clerk';
    expect(getClerkProxyUrl()).toBe('https://auth.tsccoreknot.com/__clerk');
    env.VITE_SITE_MODE = 'app';
  });

  it('uses primary app proxy for live keys on app site', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_APP_URL = 'https://tsccoreknot.com';
    expect(getClerkProxyUrl()).toBe('https://tsccoreknot.com/__clerk');
  });

  it('respects explicit proxy URL override', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_test';
    env.VITE_CLERK_PROXY_URL = 'https://auth.example.com/__clerk';
    expect(getClerkProxyUrl()).toBe('https://auth.example.com/__clerk');
  });

  it('skips proxy for test keys', () => {
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    expect(getClerkProxyUrl()).toBe('');
    expect(isClerkLiveKey()).toBe(false);
  });
});
