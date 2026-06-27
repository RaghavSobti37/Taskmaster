import React from 'react';
import { EXLY_PAGE_LEGEND } from '../../utils/exlyCourseLabels';

const MENTOR_SWATCH = {
  Sandesh: 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)] border-[var(--color-pastel-mint-text)]/20',
  Prasad: 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border-[var(--color-pastel-rose-text)]/20',
};

const ExlyPageLegend = () => (
  <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/60">
    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
      Legend
    </p>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[var(--color-text-primary)]">
      {EXLY_PAGE_LEGEND.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5 min-w-0">
          <span className="font-black uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
            {item.label}
          </span>
          <span className="text-[var(--color-text-muted)]">—</span>
          <span>{item.hint}</span>
        </span>
      ))}
    </div>
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        Mentors
      </span>
      {['Sandesh', 'Prasad'].map((name) => (
        <span
          key={name}
          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            MENTOR_SWATCH[name] || 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-[var(--color-bg-border)]'
          }`}
        >
          {name}
        </span>
      ))}
    </div>
  </div>
);

export default ExlyPageLegend;
