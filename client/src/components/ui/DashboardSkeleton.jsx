import React from 'react';
import { PageContainer, Card, Skeleton } from './primitives';

const DashboardSkeleton = () => {
  return (
    <PageContainer className="!py-4 !space-y-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="350px" height="16px" />
        </div>
        <Skeleton width="120px" height="36px" />
      </div>

      {/* Analytical Ribbon Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4 h-[100px] flex flex-col justify-between">
            <div className="flex justify-between items-center">
               <Skeleton width="80px" height="12px" />
               <Skeleton variant="circle" width="16px" height="16px" />
            </div>
            <Skeleton width="120px" height="24px" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Activity Center Skeleton */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="flex flex-col h-[500px]">
            <div className="p-4 border-b border-[var(--color-bg-border)] flex justify-between items-center">
              <Skeleton width="150px" height="16px" />
              <Skeleton width="200px" height="32px" />
            </div>
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton variant="circle" width="24px" height="24px" />
                  <Skeleton className="flex-1" height="24px" />
                  <Skeleton width="100px" height="24px" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 h-[240px] space-y-4">
            <Skeleton width="100px" height="16px" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton variant="circle" width="32px" height="32px" />
                <div className="space-y-1 flex-1">
                  <Skeleton width="70%" height="12px" />
                  <Skeleton width="40%" height="8px" />
                </div>
              </div>
            ))}
          </Card>
          <Card className="p-4 h-[240px] space-y-4">
             <Skeleton width="100px" height="16px" />
             {[1, 2].map(i => (
               <div key={i} className="space-y-2">
                 <div className="flex justify-between">
                   <Skeleton width="50%" height="10px" />
                   <Skeleton width="20%" height="10px" />
                 </div>
                 <Skeleton height="8px" />
               </div>
             ))}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

export default DashboardSkeleton;
