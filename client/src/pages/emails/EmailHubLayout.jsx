import React from 'react';
import { Outlet } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DesktopRecommendedBanner, ModuleSubnav } from '../../components/ui';
import { EMAIL_SUBNAV_ITEMS, HUB_NAV_META } from '../../utils/hubSubnavConfig';

const meta = HUB_NAV_META['/emails'];

export default function EmailHubLayout() {
  return (
    <div className="py-4 space-y-4">
      <DesktopRecommendedBanner message="Email campaign editor and analytics are optimized for desktop." />
      <ModuleSubnav
        title={meta.label}
        titleIcon={meta.icon}
        items={EMAIL_SUBNAV_ITEMS}
        mode="route"
        ariaLabel="Email hub sections"
        action={{ to: '/emails/create', label: 'Create Campaign', icon: Plus }}
      />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
