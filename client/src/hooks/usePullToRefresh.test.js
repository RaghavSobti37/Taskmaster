import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh, PTR_THRESHOLD } from './usePullToRefresh';

function fireTouch(type, clientY, target = document.body) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: [{ clientY }],
  });
  Object.defineProperty(event, 'target', { value: target });
  window.dispatchEvent(event);
}

describe('usePullToRefresh', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
    Object.defineProperty(document.documentElement, 'scrollTop', {
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not attach listeners when disabled', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() =>
      usePullToRefresh({ enabled: false, onRefresh: vi.fn() }),
    );
    expect(addSpy).not.toHaveBeenCalledWith('touchstart', expect.any(Function));
  });

  it('triggers onRefresh after pull past threshold', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePullToRefresh({ enabled: true, onRefresh }),
    );

    act(() => {
      fireTouch('touchstart', 100);
      fireTouch('touchmove', 100 + PTR_THRESHOLD / 0.45 + 10);
      fireTouch('touchend', 0);
    });

    await vi.waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it('ignores pull when not at scroll top', async () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(40);
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh({ enabled: true, onRefresh }));

    act(() => {
      fireTouch('touchstart', 100);
      fireTouch('touchmove', 200);
      fireTouch('touchend', 0);
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('uses custom scroll element when provided', async () => {
    const scrollEl = document.createElement('main');
    scrollEl.scrollTop = 0;
    document.body.appendChild(scrollEl);

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      usePullToRefresh({
        enabled: true,
        onRefresh,
        getScrollElement: () => scrollEl,
      }),
    );

    act(() => {
      fireTouch('touchstart', 80, scrollEl);
      fireTouch('touchmove', 80 + PTR_THRESHOLD / 0.45 + 10, scrollEl);
      fireTouch('touchend', 0, scrollEl);
    });

    await vi.waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    scrollEl.remove();
  });
});
