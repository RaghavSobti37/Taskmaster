import React from 'react';
import { Monitor } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Banner for pages that work best on desktop — shown on mobile only.
 */
export default function DesktopRecommendedBanner({ message, className = '' }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-[var(--radius-atomic)] border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 ${className}`}
      role="status"
    >
      <Monitor size={18} className="shrink-0 mt-0.5" />
      <p className="text-xs font-medium leading-relaxed">
        {message || 'This page is optimized for desktop. Some features may be limited on mobile.'}
      </p>
    </div>
  );
}
