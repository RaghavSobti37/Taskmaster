import React from 'react';
import { PageContainer, Card, Skeleton } from './primitives';
import { Spinner } from './Spinner';

const PageSkeleton = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      <div className="flex justify-center py-2" aria-hidden>
        <Spinner size="sm" />
      </div>
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width="180px" height="28px" />
          <Skeleton width="300px" height="14px" />
        </div>
        <Skeleton width="100px" height="32px" />
      </div>

      {/* Analytical Ribbon Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height="80px" />
        ))}
      </div>

      {/* Main Content Skeleton */}
      <Card className="flex flex-col h-[600px]">
        <div className="p-4 border-b border-[var(--color-bg-border)] flex justify-between items-center bg-[var(--color-bg-secondary)]">
          <Skeleton width="120px" height="14px" />
          <Skeleton width="180px" height="28px" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="flex gap-4 items-center">
              <Skeleton width="40px" height="40px" />
              <div className="flex-1 space-y-2">
                <Skeleton width="60%" height="12px" />
                <Skeleton width="30%" height="8px" />
              </div>
              <Skeleton width="80px" height="24px" />
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
};

export default PageSkeleton;
