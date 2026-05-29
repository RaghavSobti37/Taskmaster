import React from 'react';
import { PageContainer } from './primitives';
import PageSkeleton from './PageSkeleton';

/**
 * PageLoadGuard — PageSkeleton while route/query loads; children when ready.
 */
const PageLoadGuard = ({ loading, children, skeleton: Skeleton = PageSkeleton, className = '' }) => {
  if (loading) {
    return (
      <PageContainer className={className}>
        <Skeleton />
      </PageContainer>
    );
  }
  return children;
};

export default PageLoadGuard;
