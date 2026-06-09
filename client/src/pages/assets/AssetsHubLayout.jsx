import React from 'react';
import { Outlet } from 'react-router-dom';
import { FolderArchive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessOrgAccounts } from '../../utils/pagePermissions';
import AssetsHubSidebar from '../../components/assets/AssetsHubSidebar';

export default function AssetsHubLayout() {
  const { user } = useAuth();
  const showHubNav = canAccessOrgAccounts(user);

  if (!showHubNav) {
    return <Outlet />;
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <FolderArchive size={18} className="text-[#22d3ee]" />
        <h1 className="text-lg font-bold tracking-tight">Assets</h1>
      </div>
      <div className="flex flex-col lg:flex-row gap-6 min-h-0">
        <AssetsHubSidebar />
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
