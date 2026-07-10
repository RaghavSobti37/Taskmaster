import React from 'react';

/**
 * Archetype B — detail overlay sidebar (65/35 layout companion).
 * Section labels uppercase 11px; 16px field gap; actions pinned bottom.
 */
export function DetailSidebarSection({ label, children, className = '' }) {
  return (
    <section className={`space-y-4 ${className}`}>
      {label ? (
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] m-0">
          {label}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export default function DetailSidebarShell({ children, actions, className = '' }) {
  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">{children}</div>
      {actions ? (
        <div className="shrink-0 pt-4 mt-4 border-t border-[var(--color-bg-border)] flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
