import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldEnablePullToRefresh,
  isTouchPrimaryDevice,
  DESKTOP_MIN,
} from './useBreakpoint';

describe('pull-to-refresh eligibility', () => {
  const matchMediaMock = vi.fn();

  beforeEach(() => {
    matchMediaMock.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMediaMock);
    vi.stubGlobal('innerWidth', DESKTOP_MIN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isTouchPrimaryDevice requires coarse without fine hover', () => {
    matchMediaMock.mockImplementation((query) => ({
      matches:
        query === '(pointer: coarse)' ||
        (query === '(hover: hover) and (pointer: fine)' && false),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(isTouchPrimaryDevice()).toBe(true);

    matchMediaMock.mockImplementation((query) => ({
      matches: query === '(pointer: coarse)' || query === '(hover: hover) and (pointer: fine)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(isTouchPrimaryDevice()).toBe(false);
  });

  it('shouldEnablePullToRefresh is false at desktop width even when coarse', () => {
    vi.stubGlobal('innerWidth', DESKTOP_MIN);
    matchMediaMock.mockImplementation((query) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(shouldEnablePullToRefresh()).toBe(false);
  });

  it('shouldEnablePullToRefresh is true on mobile width with touch-primary', () => {
    vi.stubGlobal('innerWidth', DESKTOP_MIN - 1);
    matchMediaMock.mockImplementation((query) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(shouldEnablePullToRefresh()).toBe(true);
  });
});
