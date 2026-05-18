import React from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { requestNotificationPermission } from '../utils/notifications';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationTray from './NotificationTray';
import CommandPalette from './CommandPalette';
import HelpBugButton from './HelpBugButton';

const MainLayout = () => {
  const { isOpen, toggleMobileSidebar, isMobileOpen } = useSidebar();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef(null);

  React.useEffect(() => {
    requestNotificationPermission();
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-workspace)]">
      {/* Sidebar Navigation */}
      <OutletSidebar />
      <CommandPalette />

      {/* Mobile Toggle Button */}
      {!isMobileOpen && (
        <button 
          onClick={toggleMobileSidebar}
          className="fixed bottom-6 right-24 z-50 p-4 bg-[var(--color-action-primary)] text-white rounded-2xl shadow-2xl shadow-blue-500/40 lg:hidden active:scale-95 transition-transform"
        >
          <Menu size={24} />
        </button>
      )}

      <HelpBugButton />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[180px]">
        <main 
          className="flex-1 p-6 lg:p-8"
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
