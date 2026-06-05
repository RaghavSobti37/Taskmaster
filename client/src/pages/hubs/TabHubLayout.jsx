import React, { useEffect, useMemo } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import { HUB_CONFIG } from '../../utils/navbarConfig';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { getMobilePageSupport, MOBILE_PAGE_LEVEL } from '../../utils/mobilePageSupport';

export default function TabHubLayout({ hubPath, panels }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const hub = HUB_CONFIG[hubPath];

  const visibleTabs = useMemo(
    () => (hub?.tabs || []).filter((tab) => hasPageAccess(user, tab.key)),
    [hub, user]
  );

  const mobileTabs = useMemo(
    () => visibleTabs.filter((tab) => {
      if (!isMobile) return true;
      const support = getMobilePageSupport(hubPath, `?tab=${tab.id}`);
      return support.level !== MOBILE_PAGE_LEVEL.DESKTOP;
    }),
    [visibleTabs, isMobile, hubPath]
  );

  const tabParam = searchParams.get('tab');
  const tabPool = isMobile ? mobileTabs : visibleTabs;
  const resolvedTab = tabPool.find((tab) => tab.id === tabParam)?.id
    || tabPool.find((tab) => tab.id === hub.defaultTab)?.id
    || tabPool[0]?.id;

  useEffect(() => {
    if (!resolvedTab) return;
    if (tabParam !== resolvedTab) {
      setSearchParams({ tab: resolvedTab }, { replace: true });
    }
  }, [resolvedTab, tabParam, setSearchParams]);

  if (!visibleTabs.length) {
    return <Navigate to="/dashboard" replace />;
  }

  const Panel = panels[resolvedTab];
  if (!Panel) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col min-h-0 lg:h-full gap-3">
      <div
        role="tablist"
        aria-label={`${hub.label} sections`}
        className="flex flex-wrap gap-1 border-b border-[var(--color-bg-border)] pb-2"
      >
        {(isMobile ? mobileTabs : visibleTabs).map((tab) => {
          const active = tab.id === resolvedTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`hub-panel-${tab.id}`}
              id={`hub-tab-${tab.id}`}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                active
                  ? 'bg-[var(--token-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-action-primary)]/30'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--token-surface-2)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`hub-panel-${resolvedTab}`}
        aria-labelledby={`hub-tab-${resolvedTab}`}
        className="min-h-0 flex-1"
      >
        <Panel />
      </div>
    </div>
  );
}
