import React from 'react';

const shimmer =
  'animate-pulse rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)]';

export function SkeletonLine({ className = 'h-3 w-full' }) {
  return <div className={`${shimmer} ${className}`} aria-hidden />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 rounded-xl border border-[var(--color-bg-border)] p-4 ${className}`} aria-hidden>
      <SkeletonLine className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${shimmer} h-20`} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={`h-${i}`} className="h-3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={`${r}-${c}`} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}
