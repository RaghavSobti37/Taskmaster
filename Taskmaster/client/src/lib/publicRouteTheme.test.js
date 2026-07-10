import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('publicRouteTheme', () => {
  const envBackup = { ...import.meta.env };

  afterEach(() => {
    Object.assign(import.meta.env, envBackup);
    vi.resetModules();
  });

  it('treats login and landing paths as public on app site', async () => {
    import.meta.env.VITE_SITE_MODE = 'app';
    const { isPublicThemeRoute } = await import('./publicRouteTheme.js');

    expect(isPublicThemeRoute('/login')).toBe(true);
    expect(isPublicThemeRoute('/login/sso-callback')).toBe(true);
    expect(isPublicThemeRoute('/landing')).toBe(true);
    expect(isPublicThemeRoute('/register')).toBe(true);
    expect(isPublicThemeRoute('/privacy')).toBe(true);
    expect(isPublicThemeRoute('/dashboard')).toBe(false);
    expect(isPublicThemeRoute('/')).toBe(false);
  });

  it('treats root as public on landing and auth site modes', async () => {
    import.meta.env.VITE_SITE_MODE = 'landing';
    const landing = await import('./publicRouteTheme.js');
    expect(landing.isPublicThemeRoute('/')).toBe(true);

    vi.resetModules();
    import.meta.env.VITE_SITE_MODE = 'auth';
    const auth = await import('./publicRouteTheme.js');
    expect(auth.isPublicThemeRoute('/')).toBe(true);
  });

  it('resolveStoredThemePreference honors explicit light/dark and system', async () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    const { resolveStoredThemePreference } = await import('./publicRouteTheme.js');

    expect(resolveStoredThemePreference('dark')).toBe('dark');
    expect(resolveStoredThemePreference('light')).toBe('light');
    expect(resolveStoredThemePreference('system')).toBe('dark');
    expect(resolveStoredThemePreference(null)).toBe('dark');

    vi.unstubAllGlobals();
  });

  it('bootstrapDocumentTheme applies system theme on public routes', async () => {
    import.meta.env.VITE_SITE_MODE = 'app';
    const classList = { remove: vi.fn(), add: vi.fn() };
    vi.stubGlobal('window', {
      location: { pathname: '/login' },
      matchMedia: vi.fn(() => ({ matches: false })),
      localStorage: { getItem: vi.fn(() => 'dark') },
    });
    vi.stubGlobal('document', { documentElement: { classList } });

    const { bootstrapDocumentTheme } = await import('./publicRouteTheme.js');
    bootstrapDocumentTheme('/login');

    expect(classList.remove).toHaveBeenCalledWith('light', 'dark');
    expect(classList.add).toHaveBeenCalledWith('light');

    vi.unstubAllGlobals();
  });

  it('bootstrapDocumentTheme applies saved preference on app routes', async () => {
    import.meta.env.VITE_SITE_MODE = 'app';
    const classList = { remove: vi.fn(), add: vi.fn() };
    vi.stubGlobal('window', {
      location: { pathname: '/dashboard' },
      matchMedia: vi.fn(() => ({ matches: false })),
      localStorage: { getItem: vi.fn(() => 'dark') },
    });
    vi.stubGlobal('document', { documentElement: { classList } });

    const { bootstrapDocumentTheme } = await import('./publicRouteTheme.js');
    bootstrapDocumentTheme('/dashboard');

    expect(classList.add).toHaveBeenCalledWith('dark');

    vi.unstubAllGlobals();
  });
});
