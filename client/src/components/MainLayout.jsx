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
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';
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
        className="flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? (isOpen ? 160 : 56) : 0,
        }}
      >
        <main
          className={`flex-1 min-h-0 flex flex-col ${
            isChatPage ? 'p-0 pb-24 lg:pb-0 overflow-hidden h-[100dvh] max-h-[100dvh]' : 'p-4 pb-24 lg:p-5'
          }`}
        >
          <div className={`w-full min-h-0 ${isChatPage ? 'flex-1 flex flex-col' : ''}`}>
            {!isChatPage && <ProfileCompletionAlerts />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
