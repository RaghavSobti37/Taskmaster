import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './primitives';
import Banner from './Banner';

export function getQueryErrorMessage(error, fallback = 'Failed to load data') {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || fallback;
}

export default function QueryErrorBanner({ message, onRetry, className = '' }) {
  return (
    <Banner
      variant="error"
      message={message}
      className={className}
      actions={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
            <RefreshCw size={14} aria-hidden /> Retry
          </Button>
        ) : null
      }
    />
  );
}
