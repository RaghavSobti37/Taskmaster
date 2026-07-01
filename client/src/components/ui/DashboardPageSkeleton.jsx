import React from 'react';
import { Skeleton } from './primitives';
import DashboardWidgetSkeleton from './DashboardWidgetSkeleton';

/** Dashboard body while widgets load — welcome row stays real in Dashboard.jsx. */
export default function DashboardPageSkeleton() {
  return (
    <div className="space-y-4 min-w-0" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid w-full min-w-0 gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <DashboardWidgetSkeleton key={i} />
        ))}
      </div>
      <div className="hidden lg:block space-y-3" aria-hidden>
        <Skeleton width="200px" height="10px" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <DashboardWidgetSkeleton key={`analytics-${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
