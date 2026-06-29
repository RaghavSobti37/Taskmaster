import React from 'react';
import QueryErrorBanner, { getQueryErrorMessage } from './QueryErrorBanner';

/** Drop-in error banner for React Query / axios list pages. */
export default function QueryErrorSlot({
  isError,
  error,
  onRetry,
  fallback = 'Failed to load data',
  className = '',
}) {
  if (!isError) return null;
  return (
    <QueryErrorBanner
      className={className}
      message={getQueryErrorMessage(error, fallback)}
      onRetry={onRetry}
    />
  );
}
