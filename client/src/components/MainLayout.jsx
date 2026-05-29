import React from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CommandPalette from './CommandPalette';
import NotificationBridge from './NotificationBridge';
import PwaInstallBanner from './PwaInstallBanner';
import QuickAddMenu from './QuickAddMenu';
import FlashHighlightListener from './ui/FlashHighlight';

const MainLayout = () => {
  const { isOpen, toggleMobileSidebar, isMobileOpen } = useSidebar();
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  React.useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef(null);

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

      <NotificationBridge />
      <PwaInstallBanner />
      <FlashHighlightListener />
      <QuickAddMenu />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? (isOpen ? 160 : 56) : 0,
        }}
      >
        <main className="flex-1 p-4 lg:p-5">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
