import React, { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { usePullToRefreshEnabled } from '../../hooks/useBreakpoint';
import { usePullToRefresh, PTR_THRESHOLD } from '../../hooks/usePullToRefresh';
import { refreshMobilePage } from '../../lib/pageRefresh';
import { Spinner } from '../ui/Spinner';

const ARTIST_WORKSPACE_SCROLL = '[data-artist-workspace-scroll]';

/**
 * Mobile pull-to-refresh — window scroll or artist-workspace inner main.
 * Never mounts on desktop layout (≥1024px / PWA desktop); touch phones only.
 */
export default function MobilePullToRefresh() {
  const enabled = usePullToRefreshEnabled();
  if (!enabled) return null;
  return <MobilePullToRefreshInner />;
}

function MobilePullToRefreshInner() {
  const location = useLocation();
  const queryClient = useQueryClient();

  const getScrollElement = useCallback(() => {
    if (location.pathname.startsWith('/artist-workspace/')) {
      return document.querySelector(ARTIST_WORKSPACE_SCROLL);
    }
    return null;
  }, [location.pathname]);

  const onRefresh = useCallback(
    () => refreshMobilePage(queryClient),
    [queryClient],
  );

  const { pullDistance, isRefreshing, indicatorVisible, progress } = usePullToRefresh({
    enabled: true,
    onRefresh,
    getScrollElement,
  });

  const indicatorStyle = useMemo(() => {
    if (!indicatorVisible) return undefined;
    const offset = Math.min(pullDistance, PTR_THRESHOLD + 16);
    return {
      transform: `translateY(${offset - PTR_THRESHOLD}px)`,
      opacity: Math.max(0.35, progress),
    };
  }, [indicatorVisible, progress, pullDistance]);

  if (!indicatorVisible) return null;

  return (
    <div
      className="mobile-ptr-indicator fixed left-0 right-0 z-[75] flex justify-center pointer-events-none lg:hidden"
      style={indicatorStyle}
      aria-hidden={false}
      data-testid="mobile-ptr-indicator"
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] shadow-md">
        {isRefreshing ? (
          <Spinner size="sm" />
        ) : (
          <ChevronDown
            size={18}
            strokeWidth={2.25}
            className="text-[var(--color-action-primary)]"
            style={{ transform: `rotate(${progress * 180}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
