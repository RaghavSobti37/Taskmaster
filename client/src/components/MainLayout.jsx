import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { QuickAddProvider } from '../contexts/QuickAddContext.jsx';
import BottomNavigation from './BottomNavigation';
import QuickAddMenu from './QuickAddMenu';
import { useSidebar, SIDEBAR_SHELL_WIDTH_OPEN, SIDEBAR_SHELL_WIDTH_COLLAPSED } from '../contexts/SidebarContext';
import { useWindowSize, DESKTOP_MIN } from '../hooks/useBreakpoint';
import MobileRouteGuard from './mobile/MobileRouteGuard';
import MobilePullToRefresh from './mobile/MobilePullToRefresh';
import NetworkStatusBanner from './NetworkStatusBanner';
import RouteErrorBoundary from './RouteErrorBoundary';
import RouteContentSkeleton from './ui/RouteContentSkeleton';
import BrandedLoadingPanel from './ui/BrandedLoadingPanel';
import { useAuth } from '../contexts/AuthContext';
import { scheduleIdlePrefetch } from '../lib/navPrefetch';
import { KeyboardShortcutsProvider } from '../contexts/KeyboardShortcutsContext';
import OnboardingTour from './onboarding/OnboardingTour';
import { createLazyWithRetry } from '../utils/lazyWithRetry';

const lazyWithRetry = createLazyWithRetry;

const AttendancePromptModal = lazyWithRetry(() => import('./attendance/AttendancePromptModal'));

function MainRouteSuspenseFallback() {
  const { pathname } = useLocation();
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7593/ingest/75bc4ee5-8ab2-4010-83b9-7267b331142a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c0551d' },
      body: JSON.stringify({
        sessionId: 'c0551d',
        runId: 'pre-fix',
        hypothesisId: 'C',
        location: 'MainLayout.jsx:MainRouteSuspenseFallback',
        message: 'route suspense skeleton shown',
        data: { pathname },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [pathname]);
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return <BrandedLoadingPanel />;
  }
  return <RouteContentSkeleton />;
}

const CommandPalette = lazyWithRetry(() => import('./CommandPalette'));
const PwaInstallBanner = lazyWithRetry(() => import('./PwaInstallBanner'));
const NotificationBridge = lazyWithRetry(() => import('./NotificationBridge'));
const MobileAppShell = lazyWithRetry(() => import('./mobile/MobileAppShell'));
const ProfileCompletionAlerts = lazyWithRetry(() => import('./ProfileCompletionAlerts'));
const ForcePasswordChangeGate = lazyWithRetry(() => import('./auth/ForcePasswordChangeGate'));
const FlashHighlightListener = lazyWithRetry(() => import('./ui/FlashHighlight'));
const KeyboardShortcutsOverlay = lazyWithRetry(() => import('./KeyboardShortcutsOverlay'));
const GChordHint = lazyWithRetry(() => import('./GChordHint'));

const MainLayout = () => {
  const { isOpen } = useSidebar();
  const { width } = useWindowSize();
  // ponytail: viewport width beats PWA-desktop hook below lg — no margin when sidebar is off-screen
  const applySidebarMargin = width >= DESKTOP_MIN;
  const { user } = useAuth();
  const [attendancePromptReady, setAttendancePromptReady] = useState(false);

  useEffect(() => {
    if (user?._id) scheduleIdlePrefetch(user._id, user);
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
    <MobilePullToRefresh />
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
        <PwaInstallBanner />
        <QuickAddMenu />
        <BottomNavigation />
        <FlashHighlightListener />
        <KeyboardShortcutsOverlay />
        <GChordHint />
      </Suspense>
      <OnboardingTour />
      {attendancePromptReady && (
        <Suspense fallback={null}>
          <AttendancePromptModal />
        </Suspense>
      )}

      <div
        className="flex-1 flex flex-col min-w-0 w-full transition-[margin] duration-300 ease-in-out max-lg:!ml-0"
        style={{
          marginLeft: applySidebarMargin
            ? (isOpen ? SIDEBAR_SHELL_WIDTH_OPEN : SIDEBAR_SHELL_WIDTH_COLLAPSED)
            : 0,
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
              <ForcePasswordChangeGate />
            </Suspense>
            <MobileRouteGuard>
              <RouteErrorBoundary>
                <Suspense fallback={<MainRouteSuspenseFallback />}>
                  <Outlet />
                </Suspense>
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
