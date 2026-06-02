import React from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CommandPalette from './CommandPalette';
import NotificationBridge from './NotificationBridge';
import PwaInstallBanner from './PwaInstallBanner';
import ProfileCompletionAlerts from './ProfileCompletionAlerts';
import ForcePasswordChangeModal from './auth/ForcePasswordChangeModal';
import AttendancePromptModal from './attendance/AttendancePromptModal';
import QuickAddMenu from './QuickAddMenu';
import FlashHighlightListener from './ui/FlashHighlight';
import PageAnalyticsTracker from './PageAnalyticsTracker';
import BottomNavigation from './BottomNavigation';
import { useIsDesktop } from '../hooks/useBreakpoint';


const MainLayout = () => {
  const { isOpen, toggleMobileSidebar, isMobileOpen } = useSidebar();
  const isDesktop = useIsDesktop();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

      <NotificationBridge />
      <PageAnalyticsTracker />
      <PwaInstallBanner />
      <FlashHighlightListener />
      <QuickAddMenu />
      <BottomNavigation />
      <ForcePasswordChangeModal />
      <AttendancePromptModal />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 w-full transition-[margin] duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? (isOpen ? 160 : 56) : 0,
        }}
      >
        <main
          data-page-root
          className="flex-1 w-full min-w-0 p-4 pb-24 lg:p-5 lg:min-h-0 lg:flex lg:flex-col overflow-x-clip"
        >
          <div className="w-full lg:min-h-0">
            <ProfileCompletionAlerts />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
