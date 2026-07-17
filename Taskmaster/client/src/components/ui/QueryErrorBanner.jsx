import React from 'react';
import { RefreshCw } from 'lucide-react';
import { hardReloadApp } from '../../utils/chunkRecovery';
import { Button } from './primitives';
import Banner from './Banner';

export function getQueryErrorMessage(error, fallback = 'Failed to load data') {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || fallback;
}

export default function QueryErrorBanner({
  message,
  error,
  onRetry,
  className = '',
}) {
  const resolvedMessage = message || getQueryErrorMessage(error);
  const handleRefresh = onRetry || (() => { void hardReloadApp(); });

  return (
    <Banner
      variant="error"
      message={resolvedMessage}
      className={className}
      actions={
        <Button size="sm" variant="secondary" onClick={handleRefresh} className="shrink-0">
          <RefreshCw size={14} aria-hidden /> Refresh
        </Button>
      }
    />
  );
}
