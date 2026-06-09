import React from 'react';
import { Outlet } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { DesktopRecommendedBanner } from '../../components/ui';
import EmailHubSidebar from '../../components/emails/EmailHubSidebar';

export default function EmailHubLayout() {
  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Mail size={18} className="text-[var(--color-action-primary)]" />
        <h1 className="text-lg font-bold tracking-tight">Emails</h1>
      </div>
      <DesktopRecommendedBanner message="Email campaign editor and analytics are optimized for desktop." />
      <div className="flex flex-col lg:flex-row gap-6 min-h-0">
        <EmailHubSidebar />
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
