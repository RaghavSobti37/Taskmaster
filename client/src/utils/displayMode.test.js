import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMobileBrowser, shouldUseSameOriginApi } from './displayMode';

describe('displayMode mobile API routing', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  beforeEach(() => {
    vi.stubGlobal('window', {
      navigator: { userAgent: '', platform: 'Win32', maxTouchPoints: 0, standalone: false },
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    vi.stubGlobal('navigator', window.navigator);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.navigator = originalNavigator;
    global.window = originalWindow;
  });

  it('detects iPhone user agent as mobile', () => {
    window.navigator.userAgent =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(isMobileBrowser()).toBe(true);
    expect(shouldUseSameOriginApi()).toBe(true);
  });

  it('detects coarse pointer as mobile', () => {
    window.matchMedia = vi.fn((query) => ({ matches: query === '(pointer: coarse)' }));
    expect(isMobileBrowser()).toBe(true);
    expect(shouldUseSameOriginApi()).toBe(true);
  });

  it('keeps desktop fine pointer on direct API', () => {
    window.navigator.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';
    window.matchMedia = vi.fn((query) => ({
      matches: query === '(pointer: fine)' || query === '(hover: hover)',
    }));
    expect(isMobileBrowser()).toBe(false);
    expect(shouldUseSameOriginApi()).toBe(false);
  });
});
