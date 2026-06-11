import React from 'react';
import { PageSkeleton } from '../../../components/ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../../../components/ui/QueryErrorBanner';

export default function ArtistOsQueryShell({
  isLoading,
  isError,
  error,
  refetch,
  isPreview,
  children,
}) {
  if (isLoading && !isPreview) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      {isError && !isPreview && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load artist data')}
          onRetry={() => refetch?.()}
        />
      )}
      {children}
    </div>
  );
}
