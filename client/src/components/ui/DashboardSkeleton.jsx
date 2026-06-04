import React from 'react';
import { PageContainer, Card, Skeleton } from './primitives';
import { Spinner } from './Spinner';

const DashboardSkeleton = () => {
  return (
    <PageContainer className="!py-4 !space-y-4">
      <div className="flex justify-center py-2" aria-hidden>
        <Spinner size="sm" />
      </div>
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="350px" height="16px" />
        </div>
        <Skeleton width="120px" height="36px" />
      </div>

      <div className="dashboard-widget-grid grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-px grid-flow-row-dense auto-rows-max">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="dashboard-grid-item">
            <Card className="dashboard-widget flex flex-col min-h-[200px] p-0">
              <div className="dashboard-widget-header px-4 h-11 border-b border-[var(--color-bg-border)] flex justify-between items-center">
                <Skeleton width="120px" height="12px" />
                <Skeleton width="48px" height="20px" />
              </div>
              <div className="divide-y divide-[var(--color-bg-border)] flex-1">
                {[1, 2, 3].map(j => (
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
          </div>
        ))}
      </div>
    </PageContainer>
  );
};

export default DashboardSkeleton;
