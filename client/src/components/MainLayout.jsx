import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { QuickAddProvider } from '../contexts/QuickAddContext.jsx';
import BottomNavigation from './BottomNavigation';
import QuickAddMenu from './QuickAddMenu';
import { useSidebar, SIDEBAR_SHELL_WIDTH_OPEN, SIDEBAR_SHELL_WIDTH_COLLAPSED } from '../contexts/SidebarContext';
import ForcePasswordChangeModal from './auth/ForcePasswordChangeModal';
import { useIsDesktop } from '../hooks/useBreakpoint';
import MobileRouteGuard from './mobile/MobileRouteGuard';
import NetworkStatusBanner from './NetworkStatusBanner';
import RouteErrorBoundary from './RouteErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { scheduleIdlePrefetch } from '../lib/navPrefetch';
import { KeyboardShortcutsProvider } from '../contexts/KeyboardShortcutsContext';
import OnboardingTour from './onboarding/OnboardingTour';

const AttendancePromptModal = lazy(() => import('./attendance/AttendancePromptModal'));

const CommandPalette = lazy(() => import('./CommandPalette'));
const PwaInstallBanner = lazy(() => import('./PwaInstallBanner'));
const PageAnalyticsTracker = lazy(() => import('./PageAnalyticsTracker'));
const NotificationBridge = lazy(() => import('./NotificationBridge'));
const MobileAppShell = lazy(() => import('./mobile/MobileAppShell'));
const ProfileCompletionAlerts = lazy(() => import('./ProfileCompletionAlerts'));
const FlashHighlightListener = lazy(() => import('./ui/FlashHighlight'));
const KeyboardShortcutsOverlay = lazy(() => import('./KeyboardShortcutsOverlay'));
const GChordHint = lazy(() => import('./GChordHint'));

const MainLayout = () => {
  const { isOpen } = useSidebar();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const [attendancePromptReady, setAttendancePromptReady] = useState(false);

  useEffect(() => {
    if (user?._id) scheduleIdlePrefetch(user._id);
  }, [user?._id]);

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
    <KeyboardShortcutsProvider>
    <QuickAddProvider>
    <NetworkStatusBanner />
    <div className="flex min-h-screen bg-[var(--color-bg-workspace)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-bg-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>
      <OutletSidebar />
      <Suspense fallback={null}>
        <MobileAppShell />
        <CommandPalette />
        <NotificationBridge />
        <PageAnalyticsTracker />
        <PwaInstallBanner />
        <QuickAddMenu />
        <BottomNavigation />
        <FlashHighlightListener />
        <KeyboardShortcutsOverlay />
        <GChordHint />
      </Suspense>
      <OnboardingTour />
      <ForcePasswordChangeModal />
      {attendancePromptReady && (
        <Suspense fallback={null}>
          <AttendancePromptModal />
        </Suspense>
      )}

      <div
        className="flex-1 flex flex-col min-w-0 w-full transition-[margin] duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? (isOpen ? SIDEBAR_SHELL_WIDTH_OPEN : SIDEBAR_SHELL_WIDTH_COLLAPSED) : 0,
        }}
      >
        <main
          id="main-content"
          data-page-root
          data-tour="main-content"
          className="flex-1 w-full min-w-0 tm-page-shell lg:min-h-0 lg:flex lg:flex-col overflow-x-clip"
        >
          <div className="w-full lg:min-h-0">
            <Suspense fallback={null}>
              <ProfileCompletionAlerts />
            </Suspense>
            <MobileRouteGuard>
              <RouteErrorBoundary>
                <Outlet />
              </RouteErrorBoundary>
            </MobileRouteGuard>
          </div>
        </main>
      </div>
    </div>
    </QuickAddProvider>
    </KeyboardShortcutsProvider>
  );
};

export default MainLayout;
