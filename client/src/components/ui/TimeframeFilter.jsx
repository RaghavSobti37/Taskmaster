import React, { useLayoutEffect } from 'react';
import { useSlidingTabs } from '../../hooks/transitions';

export default function TimeframeFilter({ value, onChange }) {
  const options = ['1d', '7d', '30d'];
  const { barRef, pillRef, movePill } = useSlidingTabs('[aria-selected="true"]');

  useLayoutEffect(() => {
    movePill(true);
  }, [value, movePill]);

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-label="Timeframe"
      className="t-tabs tm-toolbar-control inline-flex items-center bg-[var(--color-bg-secondary)] rounded-[var(--radius-atomic)] px-1 border border-[var(--color-bg-border)] shrink-0"
    >
      <div ref={pillRef} className="t-tabs-pill" aria-hidden />
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={value === opt}
          onClick={() => onChange(opt)}
          className={`t-tab px-2.5 h-7 text-[10px] font-bold rounded-[var(--radius-atomic)] ${
            value === opt
              ? 'is-active text-[var(--color-action-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
