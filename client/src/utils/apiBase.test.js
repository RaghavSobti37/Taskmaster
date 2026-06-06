import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiPath, getAxiosBaseURL, getRealtimeOrigin } from './apiBase';

describe('apiBase unified routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses same-origin /api in dev and production builds', () => {
    expect(getAxiosBaseURL()).toBeUndefined();
    expect(apiPath('/api/auth/login')).toBe('/api/auth/login');
  });

  it('uses window origin for realtime in dev and production builds', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    expect(getRealtimeOrigin()).toBe('http://localhost:5173');
  });
});
