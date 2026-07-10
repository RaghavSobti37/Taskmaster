import React from 'react';

const AttendanceStatusLegend = ({ className = '' }) => (
  <div className={`flex flex-wrap gap-4 text-[10px] font-bold uppercase text-[var(--color-text-muted)] ${className}`.trim()}>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm bg-emerald-500/90 border border-emerald-600/60" />
      Present
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm bg-amber-400/80 border border-amber-500/50" />
      Half Day
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm bg-[var(--color-pastel-violet-bg)] border border-[var(--color-pastel-violet-text)]/40" />
      Holiday
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm bg-[var(--color-pastel-rose-bg)] border border-[var(--color-pastel-rose-text)]/40" />
      Leave
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]" />
      No input
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm ring-2 ring-inset ring-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10" />
      Today
    </span>
  </div>
);

export default AttendanceStatusLegend;
