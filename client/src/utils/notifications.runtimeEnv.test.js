import { describe, it, expect, vi, afterEach } from 'vitest';
import { canUseWebPush, getPushUnsupportedReason } from './notifications';

describe('notifications push runtime env', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows push on production host even when DEV is true', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0',
      serviceWorker: {},
      maxTouchPoints: 0,
      platform: 'Win32',
    });
    vi.stubGlobal('window', {
      location: { hostname: 'tsccoreknot.com' },
      PushManager: {},
      Notification: {},
      matchMedia: () => ({ matches: false }),
    });
    import.meta.env.DEV = true;

    expect(getPushUnsupportedReason()).toBeNull();
    expect(canUseWebPush()).toBe(true);
  });

  it('blocks push on localhost vite dev', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0',
      serviceWorker: {},
      maxTouchPoints: 0,
      platform: 'Win32',
    });
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
      PushManager: {},
      Notification: {},
      matchMedia: () => ({ matches: false }),
    });
    import.meta.env.DEV = true;

    expect(getPushUnsupportedReason()).toContain('local dev');
    expect(canUseWebPush()).toBe(false);
  });
});
