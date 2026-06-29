import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Collapsible dashboard tier — status strip, analytics, more widgets.
 */
export default function DashboardCollapsibleSection({
  title,
  subtitle,
  sectionLabel,
  defaultCollapsed = true,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  trailing = null,
  children,
  className = '',
  strip = false,
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggle = () => {
    const next = !collapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternalCollapsed(next);
  };

  if (strip && collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/80 text-left hover:bg-[var(--color-bg-secondary)] transition-colors ${className}`}
      >
        <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />
        <span className="text-emerald-500 shrink-0" aria-hidden>✓</span>
        <span className="text-xs text-[var(--color-text-muted)] truncate">
          <span className="font-semibold text-[var(--color-text-secondary)]">{title}</span>
          {subtitle ? ` — ${subtitle}` : ''}
        </span>
        {trailing ? (
          <span className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {trailing}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <section className={`space-y-3 ${className}`}>
      {sectionLabel && (
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-0.5">
          {sectionLabel}
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[40px] rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/60 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        {collapsed ? (
          <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[var(--color-text-muted)] shrink-0" />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
          {title}
        </span>
        {collapsed && subtitle && (
          <span className="text-[11px] text-[var(--color-text-muted)] truncate hidden sm:inline">
            — {subtitle}
          </span>
        )}
        {trailing ? (
          <span className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {trailing}
          </span>
        ) : null}
      </button>
      {!collapsed && <div className="space-y-3">{children}</div>}
    </section>
  );
}
