import React from 'react';
import { PageContainer } from './primitives';
import PageSkeleton from './PageSkeleton';
import QueryErrorSlot from './QueryErrorSlot';
import SkeletonReveal from './SkeletonReveal';

/**
 * PageLoadGuard — skeleton pulse + reveal when route/query loads.
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

  return (
    <PageContainer className={className}>
      <SkeletonReveal loading={loading} skeleton={<Skeleton />}>
        {children}
      </SkeletonReveal>
    </PageContainer>
  );
};

export default PageLoadGuard;
