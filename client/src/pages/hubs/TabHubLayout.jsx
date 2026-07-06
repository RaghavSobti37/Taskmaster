import React, { useEffect, useMemo } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import { HUB_CONFIG } from '../../utils/navbarConfig';
import { HUB_NAV_META, withHubTabIcons, HUB_TAB_FEATURE_KEYS } from '../../utils/hubSubnavConfig';
import HubPageLayout from '../../components/ui/HubPageLayout';
import ModuleSubnav from '../../components/ui/ModuleSubnav';

export default function TabHubLayout({ hubPath, panels }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hub = HUB_CONFIG[hubPath];
  const shell = HUB_NAV_META[hubPath];

  const visibleTabs = useMemo(
    () => (hub?.tabs || []).filter((tab) => hasPageAccess(user, tab.key)),
    [hub, user]
  );

  const tabParam = searchParams.get('tab');
  const resolvedTab = visibleTabs.find((tab) => tab.id === tabParam)?.id
    || visibleTabs.find((tab) => tab.id === hub.defaultTab)?.id
    || visibleTabs[0]?.id;

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

  const subnavItems = withHubTabIcons(visibleTabs).map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon,
    featureKey: HUB_TAB_FEATURE_KEYS[tab.id],
  }));

  return (
    <HubPageLayout
      header={(
        <ModuleSubnav
          title={shell?.label || hub.label}
          titleIcon={shell?.icon}
          items={subnavItems}
          mode="tabs"
          activeId={resolvedTab}
          onTabChange={(id) => setSearchParams({ tab: id })}
          ariaLabel={`${hub.label} sections`}
          tabsFitContent
        />
      )}
    >
      <div
        role="tabpanel"
        id={`hub-panel-${resolvedTab}`}
        aria-labelledby={`hub-tab-${resolvedTab}`}
        data-hub={hubPath.replace(/^\//, '')}
        className="tm-hub-panel list-page-stack min-h-0 flex-1 min-w-0 flex flex-col"
      >
        <Panel />
      </div>
    </HubPageLayout>
  );
}
