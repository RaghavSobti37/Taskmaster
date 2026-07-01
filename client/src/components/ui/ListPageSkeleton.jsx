import React from 'react';
import { Skeleton } from './primitives';
import TableSkeleton from './TableSkeleton';

/**
 * List/data page loading shell — stats ribbon, toolbar, table.
 * No duplicate page title (ListPageLayout / hub subnav already provide chrome).
 */
export default function ListPageSkeleton({
  statCount = 3,
  tableRows = 8,
  showToolbar = true,
  className = '',
  bare = false,
}) {
  const body = (
    <div className={`list-page-stack space-y-4 ${className}`.trim()} aria-busy="true" aria-label="Loading page">
        {statCount > 0 && (
          <div className={`grid gap-3 grid-cols-2 ${statCount > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
            {Array.from({ length: statCount }, (_, i) => (
              <Skeleton key={i} height="72px" className="rounded-[var(--radius-atomic)]" />
            ))}
          </div>
        )}
        {showToolbar && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <Skeleton height="36px" className="w-full sm:max-w-md rounded-[var(--radius-atomic)]" />
            <Skeleton width="108px" height="32px" className="rounded-[var(--radius-atomic)] shrink-0" />
          </div>
        )}
        <TableSkeleton rows={tableRows} />
      </div>
  );

  if (bare) return body;

  return (
    <div className={`tm-page-container min-w-0 w-full overflow-x-clip ${className || '!py-4'}`.trim()}>
      {body}
    </div>
  );
}
