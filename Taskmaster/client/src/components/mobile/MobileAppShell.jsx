import React, { useEffect } from 'react';
import { isStandaloneDisplay } from '../../utils/displayMode';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Standalone PWA chrome: safe-area top inset + theme-color sync for native feel.
 */
export default function MobileAppShell() {
  const isMobile = useIsMobile();
  const standalone = isStandaloneDisplay();

  useEffect(() => {
    if (!standalone || !isMobile) return undefined;

    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute('content');
    if (meta) meta.setAttribute('content', '#126d5e');

    document.documentElement.dataset.pwaStandalone = 'true';

    return () => {
      if (meta && previous) meta.setAttribute('content', previous);
      delete document.documentElement.dataset.pwaStandalone;
    };
  }, [standalone, isMobile]);

  if (!standalone || !isMobile) return null;

  return (
    <div
      className="mobile-app-status-bar fixed top-0 left-0 right-0 z-[80] pointer-events-none lg:hidden"
      aria-hidden
    >
      <div className="h-[env(safe-area-inset-top)] bg-[#126d5e]" />
    </div>
  );
}
