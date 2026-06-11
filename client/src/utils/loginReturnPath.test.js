import { describe, it, expect } from 'vitest';
import { resolveLoginReturnPath } from './loginReturnPath';

describe('resolveLoginReturnPath', () => {
  it('prefers router state.from over query redirect', () => {
    const path = resolveLoginReturnPath({
      stateFrom: { pathname: '/projects', search: '?tab=active', hash: '#top' },
      search: '?redirect=/evil-safe-looking',
    });
    expect(path).toBe('/projects?tab=active#top');
  });

  it('honors safe ?redirect= paths', () => {
    expect(resolveLoginReturnPath({ search: '?redirect=/artists/abc/os' })).toBe('/artists/abc/os');
    expect(resolveLoginReturnPath({ search: '?redirect=/settings?tab=profile' })).toBe('/settings?tab=profile');
  });

  it('rejects protocol-relative and external redirects', () => {
    expect(resolveLoginReturnPath({ search: '?redirect=//evil.com' })).toBe('/dashboard');
    expect(resolveLoginReturnPath({ search: '?redirect=https://evil.com' })).toBe('/dashboard');
    expect(resolveLoginReturnPath({ search: '?redirect=artists' })).toBe('/dashboard');
  });

  it('falls back to stored return path then dashboard', () => {
    expect(resolveLoginReturnPath({ storedReturnPath: '/todo' })).toBe('/todo');
    expect(resolveLoginReturnPath({})).toBe('/dashboard');
  });
});
