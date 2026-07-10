import React from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Active filter summary below PageToolbar — chips + Clear all (desktop-first).
 */
export default function ActiveFilterBar({ chips = [], onRemove, onClear, className = '' }) {
  const isMobile = useIsMobile();
  if (!chips.length) return null;

  return (
    <div
      className={`list-active-filter-bar flex flex-wrap items-center gap-2 py-1 min-w-0 ${className}`}
      role="region"
      aria-label="Active filters"
    >
      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] shrink-0">
        Filters
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemove?.(chip.id)}
          className="inline-flex items-center gap-1 max-w-[14rem] px-2 py-1 rounded-[var(--radius-atomic)] border border-[var(--color-action-primary)]/30 bg-[var(--color-action-primary)]/10 text-[10px] font-bold text-[var(--color-action-primary)] hover:bg-[var(--color-action-primary)]/15 transition-colors shrink-0"
          title={`Remove ${chip.label}`}
        >
          <span className="truncate">{chip.label}</span>
          <X size={12} className="shrink-0 opacity-70" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className={`text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] transition-colors shrink-0 ${isMobile ? '' : 'ml-auto'}`}
      >
        Clear all
      </button>
    </div>
  );
}
