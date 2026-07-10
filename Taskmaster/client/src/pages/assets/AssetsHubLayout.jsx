import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessOrgAccounts } from '../../utils/pagePermissions';
import { ModuleSubnav } from '../../components/ui';
import { ASSETS_SUBNAV_ITEMS, HUB_NAV_META } from '../../utils/hubSubnavConfig';

const meta = HUB_NAV_META['/assets'];

export default function AssetsHubLayout() {
  const { user } = useAuth();
  const showHubNav = canAccessOrgAccounts(user);

  if (!showHubNav) {
    return <Outlet />;
  }

  return (
    <div className="hub-page-stack min-w-0 lg:h-full lg:flex lg:flex-col">
      <div className="tm-hub-header shrink-0 min-w-0">
        <ModuleSubnav
          title={meta.label}
          titleIcon={meta.icon}
          items={ASSETS_SUBNAV_ITEMS}
          mode="route"
          ariaLabel="Assets hub sections"
        />
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
