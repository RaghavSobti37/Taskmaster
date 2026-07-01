import React from 'react';
import { Skeleton } from './primitives';

/** Table body placeholder — matches DataTable row rhythm. */
export default function TableSkeleton({ rows = 8, className = '' }) {
  return (
    <div className={`rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] overflow-hidden ${className}`.trim()} aria-hidden>
      <div className="hidden lg:block border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/60 px-4 py-2.5">
        <div className="flex gap-6">
          <Skeleton width="22%" height="10px" />
          <Skeleton width="14%" height="10px" />
          <Skeleton width="14%" height="10px" />
          <Skeleton width="18%" height="10px" />
        </div>
      </div>
      <div className="divide-y divide-[var(--color-bg-border)]">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 min-h-[44px]">
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton width={`${58 + (i % 3) * 8}%`} height="12px" />
              <Skeleton width={`${28 + (i % 2) * 10}%`} height="8px" className="hidden sm:block" />
            </div>
            <Skeleton width="64px" height="20px" className="shrink-0 hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
