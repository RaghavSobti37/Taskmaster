import React from 'react';

export default function TimeframeFilter({ value, onChange }) {
  const options = ['1d', '7d', '30d'];
  return (
    <div className="tm-toolbar-control inline-flex items-center bg-[var(--color-bg-secondary)] rounded-[var(--radius-atomic)] px-1 border border-[var(--color-bg-border)] shrink-0">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-2.5 h-7 text-[10px] font-bold rounded-[var(--radius-atomic)] transition-colors ${
            value === opt
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
