import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  clerkOrgSelectionUrl,
  isOrgFirstAuthEnabled,
  setOrgFirstAuthFromConfig,
} from './orgFirstAuth';

vi.mock('../config/siteUrls', () => ({
  authUrl: (path) => `https://auth.example.com${path}`,
  usesExternalAuthHost: vi.fn(() => false),
}));

import { usesExternalAuthHost } from '../config/siteUrls';

describe('orgFirstAuth', () => {
  beforeEach(() => {
    setOrgFirstAuthFromConfig({ orgFirstAuth: false });
    vi.stubEnv('VITE_ORG_FIRST_AUTH', '');
    usesExternalAuthHost.mockReturnValue(false);
  });

  it('isOrgFirstAuthEnabled reads VITE_ORG_FIRST_AUTH when set', () => {
    vi.stubEnv('VITE_ORG_FIRST_AUTH', 'true');
    expect(isOrgFirstAuthEnabled()).toBe(true);
    vi.stubEnv('VITE_ORG_FIRST_AUTH', 'false');
    expect(isOrgFirstAuthEnabled()).toBe(false);
  });

  it('isOrgFirstAuthEnabled falls back to server config cache', () => {
    setOrgFirstAuthFromConfig({ orgFirstAuth: true });
    expect(isOrgFirstAuthEnabled()).toBe(true);
  });

  it('clerkOrgSelectionUrl uses app path on same-origin auth', () => {
    expect(clerkOrgSelectionUrl()).toBe('/login/choose');
  });

  it('clerkOrgSelectionUrl uses auth host when split deploy', () => {
    usesExternalAuthHost.mockReturnValue(true);
    expect(clerkOrgSelectionUrl()).toBe('https://auth.example.com/login/choose');
  });
});
