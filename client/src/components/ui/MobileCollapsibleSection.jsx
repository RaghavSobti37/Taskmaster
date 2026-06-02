import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Collapsible section for mobile — analytics, insights, etc.
 */
export default function MobileCollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className = '',
  forceDesktopOpen = false,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);

  if (!isMobile || forceDesktopOpen) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] text-left"
      >
        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">{title}</span>
        {open ? (
          <ChevronUp size={16} className="text-[var(--color-text-muted)] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[var(--color-text-muted)] shrink-0" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-bg-border)] pt-3">{children}</div>}
    </div>
  );
}
