import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import ForcePasswordChangeModal from './auth/ForcePasswordChangeModal';
import { useIsDesktop } from '../hooks/useBreakpoint';

const AttendancePromptModal = lazy(() => import('./attendance/AttendancePromptModal'));

const CommandPalette = lazy(() => import('./CommandPalette'));
const QuickAddMenu = lazy(() => import('./QuickAddMenu'));
const PwaInstallBanner = lazy(() => import('./PwaInstallBanner'));
const PageAnalyticsTracker = lazy(() => import('./PageAnalyticsTracker'));
const NotificationBridge = lazy(() => import('./NotificationBridge'));
const BottomNavigation = lazy(() => import('./BottomNavigation'));
const ProfileCompletionAlerts = lazy(() => import('./ProfileCompletionAlerts'));
const FlashHighlightListener = lazy(() => import('./ui/FlashHighlight'));

const MainLayout = () => {
  const { isOpen } = useSidebar();
  const isDesktop = useIsDesktop();
  const [attendancePromptReady, setAttendancePromptReady] = useState(false);

  useEffect(() => {
    const enable = () => setAttendancePromptReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enable, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(enable, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-workspace)]">
      <OutletSidebar />
      <Suspense fallback={null}>
        <CommandPalette />
        <NotificationBridge />
        <PageAnalyticsTracker />
        <PwaInstallBanner />
        <QuickAddMenu />
        <BottomNavigation />
        <FlashHighlightListener />
      </Suspense>
      <ForcePasswordChangeModal />
      {attendancePromptReady && (
        <Suspense fallback={null}>
          <AttendancePromptModal />
        </Suspense>
      )}

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
            <Suspense fallback={null}>
              <ProfileCompletionAlerts />
            </Suspense>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
