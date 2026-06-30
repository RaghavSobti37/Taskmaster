import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('./displayMode', () => ({
  shouldUseSameOriginApi: vi.fn(() => false),
}));

import { shouldUseSameOriginApi } from './displayMode';
import { apiPath, getAxiosBaseURL, getRealtimeOrigin, isCrossOriginRealtime } from './apiBase';

describe('apiBase hybrid routing', () => {
  beforeEach(() => {
    vi.mocked(shouldUseSameOriginApi).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses same-origin /api in dev', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    expect(getAxiosBaseURL()).toBeUndefined();
    expect(apiPath('/api/auth/login')).toBe('/api/auth/login');
  });

  it('uses direct Render URL on desktop production when VITE_API_URL is set', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    vi.mocked(shouldUseSameOriginApi).mockReturnValue(false);
    expect(getAxiosBaseURL()).toBe('https://api.example.com');
    expect(apiPath('/api/auth/login')).toBe('https://api.example.com/api/auth/login');
  });

  it('uses same-origin /api on mobile/PWA production', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    vi.mocked(shouldUseSameOriginApi).mockReturnValue(true);
    expect(getAxiosBaseURL()).toBeUndefined();
    expect(apiPath('/api/auth/login')).toBe('/api/auth/login');
  });

  it('uses window origin for realtime in dev (Vite proxy)', () => {
    vi.stubEnv('DEV', true);
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    expect(getRealtimeOrigin()).toBe('http://localhost:5173');
    expect(isCrossOriginRealtime()).toBe(false);
  });

  it('uses same-origin /api on Vercel preview production', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubGlobal('window', { location: { origin: 'https://team-projects.vercel.app', hostname: 'team-projects.vercel.app' } });
    vi.mocked(shouldUseSameOriginApi).mockReturnValue(true);
    expect(getAxiosBaseURL()).toBeUndefined();
    expect(apiPath('/api/auth/login')).toBe('/api/auth/login');
  });

  it('uses VITE_API_URL for realtime in production when set', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    expect(getRealtimeOrigin()).toBe('https://api.example.com');
    expect(isCrossOriginRealtime()).toBe(true);
  });
});
