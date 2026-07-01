import { useCallback, useEffect, useRef, useState } from 'react';

export const PTR_THRESHOLD = 72;
export const PTR_MAX_PULL = 120;

function getScrollTop(scrollEl) {
  if (scrollEl) return scrollEl.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function isModalOpen() {
  return Boolean(document.querySelector('[aria-modal="true"]'));
}

function isNestedScrollerAtTop(target, scrollRoot) {
  let el = target;
  while (el && el !== scrollRoot && el !== document.body) {
    const { overflowY } = window.getComputedStyle(el);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      if (scrollRoot && scrollRoot.contains(el) && el !== scrollRoot) {
        if (el.scrollTop > 0) return false;
      } else if (!scrollRoot || !scrollRoot.contains(el)) {
        return false;
      }
    }
    el = el.parentElement;
  }
  return true;
}

/**
 * Touch pull-to-refresh for mobile web/PWA.
 * @param {{ enabled?: boolean, onRefresh?: () => Promise<void>, getScrollElement?: () => HTMLElement | null }} options
 */
export function usePullToRefresh({ enabled = true, onRefresh, getScrollElement }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullRef = useRef(0);
  const touchRef = useRef({ active: false, startY: 0, startScrollTop: 0 });
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const getScrollElementRef = useRef(getScrollElement);

  onRefreshRef.current = onRefresh;
  getScrollElementRef.current = getScrollElement;

  const resetTouch = useCallback(() => {
    touchRef.current = { active: false, startY: 0, startScrollTop: 0 };
    pullRef.current = 0;
    setPullDistance(0);
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (!onRefreshRef.current || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    pullRef.current = PTR_THRESHOLD;
    setPullDistance(PTR_THRESHOLD);
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
      resetTouch();
    }
  }, [resetTouch]);

  useEffect(() => {
    if (!enabled || !onRefresh) return undefined;

    const onTouchStart = (e) => {
      if (refreshingRef.current || isModalOpen()) return;
      const scrollEl = getScrollElementRef.current?.() ?? null;
      const scrollTop = getScrollTop(scrollEl);
      if (scrollTop > 2) return;
      if (!isNestedScrollerAtTop(e.target, scrollEl)) return;

      touchRef.current = {
        active: true,
        startY: e.touches[0].clientY,
        startScrollTop: scrollTop,
      };
    };

    const onTouchMove = (e) => {
      const touch = touchRef.current;
      if (!touch.active || refreshingRef.current) return;

      const scrollEl = getScrollElementRef.current?.() ?? null;
      const scrollTop = getScrollTop(scrollEl);
      if (scrollTop > touch.startScrollTop + 2) {
        resetTouch();
        return;
      }

      const delta = e.touches[0].clientY - touch.startY;
      if (delta <= 0) {
        pullRef.current = 0;
        setPullDistance(0);
        return;
      }

      if (scrollTop > 2) {
        resetTouch();
        return;
      }

      const distance = Math.min(delta * 0.45, PTR_MAX_PULL);
      pullRef.current = distance;
      setPullDistance(distance);
      if (distance > 8 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      const touch = touchRef.current;
      if (!touch.active) return;

      if (pullRef.current >= PTR_THRESHOLD && !refreshingRef.current) {
        void triggerRefresh();
        return;
      }
      resetTouch();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, onRefresh, resetTouch, triggerRefresh]);

  const indicatorVisible = pullDistance > 4 || isRefreshing;

  return {
    pullDistance: isRefreshing ? PTR_THRESHOLD : pullDistance,
    isRefreshing,
    indicatorVisible,
    progress: Math.min(1, pullDistance / PTR_THRESHOLD),
  };
}
