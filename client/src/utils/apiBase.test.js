import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiPath, getAxiosBaseURL, getRealtimeOrigin, isCrossOriginRealtime } from './apiBase';

describe('apiBase unified routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses same-origin /api in dev and production builds', () => {
    expect(getAxiosBaseURL()).toBeUndefined();
    expect(apiPath('/api/auth/login')).toBe('/api/auth/login');
  });

  it('uses window origin for realtime in dev (Vite proxy)', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    expect(getRealtimeOrigin()).toBe('http://localhost:5173');
    expect(isCrossOriginRealtime()).toBe(false);
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
