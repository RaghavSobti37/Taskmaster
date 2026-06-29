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
    <div className="py-4 space-y-4">
      <ModuleSubnav
        title={meta.label}
        titleIcon={meta.icon}
        items={ASSETS_SUBNAV_ITEMS}
        mode="route"
        ariaLabel="Assets hub sections"
      />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
