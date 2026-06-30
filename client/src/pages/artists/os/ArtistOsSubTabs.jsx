import React from 'react';

/** ponytail: shared sub-nav for grouped Artist OS tabs */
export default function ArtistOsSubTabs({ tabs, activeId, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Section"
      className="flex flex-wrap gap-1 border-b border-[var(--color-bg-border)] pb-2"
    >
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              active
                ? 'bg-[var(--token-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-action-primary)]/30'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--token-surface-2)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
