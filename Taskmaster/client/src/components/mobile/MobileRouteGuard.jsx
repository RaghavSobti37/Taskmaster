import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { getMobilePageSupport, shouldShowMobileBanner } from '../../utils/mobilePageSupport';
import DesktopRecommendedBanner from '../ui/DesktopRecommendedBanner';

/**
 * On mobile: optional soft banner for limited routes. All routes render — no hard blocks.
 */
export default function MobileRouteGuard({ children }) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const support = getMobilePageSupport(location.pathname, location.search);
  const showBanner = isMobile && shouldShowMobileBanner(location.pathname, location.search);

  const content = children ?? <Outlet />;

  if (!showBanner) {
    return content;
  }

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <DesktopRecommendedBanner message={support.description} />
      {content}
    </div>
  );
}
