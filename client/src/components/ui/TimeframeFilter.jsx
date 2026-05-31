import React from 'react';

export default function TimeframeFilter({ value, onChange }) {
  const options = ['1d', '7d', '30d'];
  return (
    <div className="flex items-center bg-[var(--color-bg-secondary)] rounded-full p-1 border border-[var(--color-bg-border)] shadow-sm">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${
            value === opt 
              ? 'bg-[var(--color-bg-primary)] text-blue-500 shadow-sm ring-1 ring-[var(--color-bg-border)]' 
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
