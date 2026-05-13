import React from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { requestNotificationPermission } from '../utils/notifications';
import { Menu, Search, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
  const { isOpen, toggleMobileSidebar } = useSidebar();
  const { user } = useAuth();

  React.useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-workspace)]">
      {/* Sidebar Navigation */}
      <OutletSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 flex items-center justify-between px-4 bg-[var(--color-bg-surface)] border-b border-[var(--color-bg-border)] sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleMobileSidebar}
              className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl text-[var(--color-text-secondary)] transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="w-8 h-8 bg-[var(--color-action-primary)] rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              CK
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-[var(--color-text-muted)]">
              <Search size={20} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-[var(--color-bg-border)]">
              {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">{user?.name?.[0]}</div>}
            </div>
          </div>
        </header>

        <main 
          className={`flex-1 transition-all duration-300 ease-in-out 
            ${isOpen ? 'lg:ml-64' : 'lg:ml-20'} 
            p-4 md:p-6 lg:p-8`}
        >
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
