import React from 'react';

/**
 * Wrapping filter chips — never horizontal scroll.
 */
export default function FilterChips({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 min-w-0 ${className}`} role="group">
      {children}
    </div>
  );
}

export function FilterChip({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
        active
          ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border-[var(--color-action-primary)]/30'
          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:text-[var(--color-text-primary)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}
