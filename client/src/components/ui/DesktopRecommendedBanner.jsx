import React, { useCallback, useState } from 'react';
import { Check, Copy, Monitor } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Banner for pages that work best on desktop — shown on mobile only.
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
    <div
      className={`flex items-start gap-3 p-4 rounded-[var(--radius-atomic)] border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 ${className}`}
      role="status"
    >
      <Monitor size={18} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-relaxed">
          {message || 'This page is optimized for desktop. Some features may be limited on mobile.'}
        </p>
        <button
          type="button"
          onClick={copyDesktopLink}
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:underline"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Link copied' : 'Copy link for desktop'}
        </button>
      </div>
    </div>
  );
}
