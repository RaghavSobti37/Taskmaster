import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { QuickAddProvider } from '../contexts/QuickAddContext.jsx';
import BottomNavigation from './BottomNavigation';
import QuickAddMenu from './QuickAddMenu';
import { useSidebar, SIDEBAR_SHELL_WIDTH_OPEN, SIDEBAR_SHELL_WIDTH_COLLAPSED } from '../contexts/SidebarContext';
import { useIsDesktop } from '../hooks/useBreakpoint';
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
import { stripOrgPrefix } from '../lib/orgPaths';
import { useActiveOrgSlug } from '../hooks/useOrgPath';
import { createLazyWithRetry } from '../utils/lazyWithRetry';

const lazyWithRetry = createLazyWithRetry;

const AttendancePromptModal = lazyWithRetry(() => import('./attendance/AttendancePromptModal'));

function MainRouteSuspenseFallback() {
  const { pathname } = useLocation();
  const orgSlug = useActiveOrgSlug();
  const appPath = stripOrgPrefix(pathname, orgSlug);
  if (appPath === '/dashboard' || appPath.startsWith('/dashboard/')) {
    return <BrandedLoadingPanel />;
  }
  return <RouteContentSkeleton />;
}

const CommandPalette = lazyWithRetry(() => import('./CommandPalette'));
const PwaInstallBanner = lazyWithRetry(() => import('./PwaInstallBanner'));
const CookieConsentBanner = lazyWithRetry(() => import('./legal/CookieConsentBanner'));
const NotificationBridge = lazyWithRetry(() => import('./NotificationBridge'));
const MobileAppShell = lazyWithRetry(() => import('./mobile/MobileAppShell'));
const ForcePasswordChangeGate = lazyWithRetry(() => import('./auth/ForcePasswordChangeGate'));
const FlashHighlightListener = lazyWithRetry(() => import('./ui/FlashHighlight'));
const KeyboardShortcutsOverlay = lazyWithRetry(() => import('./KeyboardShortcutsOverlay'));
const GChordHint = lazyWithRetry(() => import('./GChordHint'));

const MainLayout = () => {
  const { isOpen } = useSidebar();
  const isDesktop = useIsDesktop();
  // ponytail: useIsDesktop matches OutletSidebar — PWA installed app keeps sidebar margin + footer nav
  const applySidebarMargin = isDesktop;
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
        <CookieConsentBanner />
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
        className="flex-1 flex flex-col min-w-0 w-full transition-[margin] duration-300 ease-in-out"
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
