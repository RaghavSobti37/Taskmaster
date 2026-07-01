import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getClerkDashboardUrl,
  getPinnedClerkOrganizationId,
  isClerkConfigured,
  isClerkDashboardReady,
} from './clerk';

describe('clerk config', () => {
  const env = import.meta.env;

  beforeEach(() => {
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.VITE_CLERK_DASHBOARD_URL = '';
    env.VITE_CLERK_DASHBOARD_APP_PATH = '';
  });

  afterEach(() => {
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.VITE_CLERK_DASHBOARD_URL = '';
    env.VITE_CLERK_DASHBOARD_APP_PATH = '';
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

  it('defaults pinned organization id for TSC', () => {
    expect(getPinnedClerkOrganizationId()).toMatch(/^org_/);
  });
});
