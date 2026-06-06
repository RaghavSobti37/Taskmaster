import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiPath, getAxiosBaseURL, getRealtimeOrigin, isViteProxyDev } from './apiBase';

describe('apiBase unified routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses same-origin paths when production build or Vite proxy dev', () => {
    if (!import.meta.env.PROD && !isViteProxyDev()) {
      expect(import.meta.env.PROD || isViteProxyDev()).toBe(true);
      return;
    }
    expect(getAxiosBaseURL()).toBeUndefined();
    expect(apiPath('/api/auth/login')).toBe('/api/auth/login');
  });

  it('uses window origin for realtime when production build or Vite proxy dev', () => {
    if (!import.meta.env.PROD && !isViteProxyDev()) {
      return;
    }
    vi.stubGlobal('window', { location: { origin: 'https://tsccoreknot.com' } });
    expect(getRealtimeOrigin()).toBe('https://tsccoreknot.com');
  });
});
