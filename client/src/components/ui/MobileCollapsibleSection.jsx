import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Collapsible section for mobile — accordion expand (transitions.dev).
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
    <div
      className={`t-acc rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-hidden ${className}`}
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="t-acc-head w-full flex items-center justify-between px-4 py-3 min-h-[44px] text-left"
      >
        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">{title}</span>
        <span className="t-acc-chevron text-[var(--color-text-muted)] shrink-0" aria-hidden>
          <ChevronDown size={16} />
        </span>
      </button>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner px-4 pb-4 space-y-3 border-t border-[var(--color-bg-border)] pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
