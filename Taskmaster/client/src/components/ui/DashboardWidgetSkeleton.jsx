import React from 'react';
import { Card, Skeleton } from './primitives';

/** Lightweight placeholder while a dashboard widget chunk loads. */
export default function DashboardWidgetSkeleton() {
  return (
    <Card className="dashboard-widget flex flex-col min-h-[200px] p-0">
      <div className="dashboard-widget-header px-4 h-11 border-b border-[var(--color-bg-border)] flex justify-between items-center">
        <Skeleton width="120px" height="12px" />
        <Skeleton width="48px" height="20px" />
      </div>
      <div className="divide-y divide-[var(--color-bg-border)] flex-1">
        {[1, 2, 3].map((j) => (
          <div key={j} className="flex gap-3 items-center py-2 px-4">
            <Skeleton variant="circle" width="24px" height="24px" />
            <div className="space-y-1 flex-1">
              <Skeleton width="70%" height="12px" />
              <Skeleton width="40%" height="8px" />
            </div>
            <Skeleton width="48px" height="12px" />
          </div>
        ))}
      </div>
    </Card>
  );
}
