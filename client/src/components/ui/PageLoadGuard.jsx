import React from 'react';
import { PageContainer } from './primitives';
import PageSkeleton from './PageSkeleton';
import QueryErrorSlot from './QueryErrorSlot';

/**
 * PageLoadGuard — PageSkeleton while route/query loads; optional error banner; children when ready.
 */
const PageLoadGuard = ({
  loading,
  isError,
  error,
  onRetry,
  queryErrorFallback = 'Failed to load data',
  children,
  skeleton: Skeleton = PageSkeleton,
  className = '',
}) => {
  if (isError) {
    return (
      <PageContainer className={className}>
        <QueryErrorSlot
          isError
          error={error}
          onRetry={onRetry}
          fallback={queryErrorFallback}
        />
      </PageContainer>
    );
  }
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
