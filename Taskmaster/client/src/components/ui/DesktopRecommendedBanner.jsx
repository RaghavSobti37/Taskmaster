import React, { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import Banner from './Banner';

/**
 * Banner for pages that work best on desktop — shown on mobile only (advisory/amber).
 */
export default function DesktopRecommendedBanner({ message, className = '' }) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

  const copyDesktopLink = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link for desktop:', url);
    }
  }, []);

  if (!isMobile) return null;

  return (
    <Banner
      variant="advisory"
      className={className}
      message={(
        <div className="min-w-0">
          <p className="text-xs font-medium leading-relaxed m-0">
            {message || 'This page is optimized for desktop. Some features may be limited on mobile.'}
          </p>
          <button
            type="button"
            onClick={copyDesktopLink}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:underline"
          >
            {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
            {copied ? 'Link copied' : 'Copy link for desktop'}
          </button>
        </div>
      )}
    />
  );
}
