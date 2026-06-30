import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('siteUrls', () => {
  const envBackup = { ...import.meta.env };

  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173' },
    });
  });

  afterEach(() => {
    Object.assign(import.meta.env, envBackup);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses browser origin for auth URLs on app site when env unset', async () => {
    import.meta.env.VITE_APP_URL = '';
    import.meta.env.VITE_AUTH_URL = '';
    import.meta.env.VITE_SITE_MODE = 'app';

    const { authUrl, appUrl, hasSameOriginAuthRoutes } = await import('./siteUrls.js');

    expect(hasSameOriginAuthRoutes()).toBe(true);
    expect(authUrl('/login')).toBe('http://localhost:5173/login');
    expect(appUrl('/dashboard')).toBe('http://localhost:5173/dashboard');
  });

  it('keeps relative post-login paths on app site', async () => {
    import.meta.env.VITE_SITE_MODE = 'app';

    const { resolveAppNavigationTarget } = await import('./siteUrls.js');

    expect(resolveAppNavigationTarget('/projects')).toBe('/projects');
    expect(resolveAppNavigationTarget()).toBe('/dashboard');
  });

  it('links landing subdomain auth CTAs to configured auth host', async () => {
    import.meta.env.VITE_SITE_MODE = 'landing';
    import.meta.env.VITE_APP_URL = 'https://tsccoreknot.com';
    import.meta.env.VITE_AUTH_URL = 'https://auth.tsccoreknot.com';

    const { authUrl, hasSameOriginAuthRoutes } = await import('./siteUrls.js');

    expect(hasSameOriginAuthRoutes()).toBe(false);
    expect(authUrl('/login')).toBe('https://auth.tsccoreknot.com/login');
  });

  it('redirects app host auth slugs to auth subdomain when configured', async () => {
    import.meta.env.VITE_SITE_MODE = 'app';
    import.meta.env.VITE_APP_URL = 'https://tsccoreknot.com';
    import.meta.env.VITE_AUTH_URL = 'https://auth.tsccoreknot.com';
    import.meta.env.VITE_LANDING_URL = 'https://landing.tsccoreknot.com';

    const {
      usesExternalAuthHost,
      externalAuthRedirectTarget,
      shouldRedirectMarketingRoute,
    } = await import('./siteUrls.js');

    expect(usesExternalAuthHost()).toBe(true);
    expect(externalAuthRedirectTarget('/login', '?redirect=%2Fdashboard')).toBe(
      'https://auth.tsccoreknot.com/login?redirect=%2Fdashboard',
    );
    expect(shouldRedirectMarketingRoute('/')).toBe('https://landing.tsccoreknot.com/');
  });
});
