import React from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';

const MainLayout = () => {
  const { isOpen } = useSidebar();

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-workspace)]">
      {/* Sidebar */}
      <OutletSidebar />

      {/* Main Content Area */}
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isOpen ? 'ml-64' : 'ml-20'
        } p-[var(--spacing-container-gap)]`}
      >
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
