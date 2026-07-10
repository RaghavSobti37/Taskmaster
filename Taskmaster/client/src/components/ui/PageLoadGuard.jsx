import React from 'react';
import ListPageSkeleton from './ListPageSkeleton';
import QueryErrorSlot from './QueryErrorSlot';

const listShellClass = (className = '') =>
  `tm-page-container min-w-0 w-full overflow-x-clip ${className}`.trim();

/**
 * PageLoadGuard — full-page skeleton swap while primary query loads (no ghost overlay).
 */
const PageLoadGuard = ({
  loading,
  isError,
  error,
  onRetry,
  queryErrorFallback = 'Failed to load data',
  children,
  skeleton: Skeleton = ListPageSkeleton,
  className = '',
}) => {
  if (isError) {
    return (
      <div className={listShellClass(className)}>
        <QueryErrorSlot
          isError
          error={error}
          onRetry={onRetry}
          fallback={queryErrorFallback}
        />
      </div>
    );
  }

  if (loading) {
    return <Skeleton className={className} />;
  }

  return children;
};

export default PageLoadGuard;
