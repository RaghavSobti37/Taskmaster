import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { getMobilePageSupport, MOBILE_PAGE_LEVEL } from '../../utils/mobilePageSupport';
import DesktopRequiredScreen from './DesktopRequiredScreen';

/**
 * On mobile viewports, blocks desktop-only routes and shows DesktopRequiredScreen.
 * Limited/full routes pass through to child pages (limited pages may show their own banners).
 */
export default function MobileRouteGuard({ children }) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const support = getMobilePageSupport(location.pathname, location.search);

  if (isMobile && support.level === MOBILE_PAGE_LEVEL.DESKTOP) {
    return (
      <DesktopRequiredScreen
        title={support.title}
        description={support.description}
        alternatives={support.alternatives}
        currentPath={`${location.pathname}${location.search}`}
      />
    );
  }

  return children ?? <Outlet />;
}
