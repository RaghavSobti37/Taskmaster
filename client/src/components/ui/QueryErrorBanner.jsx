import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './primitives';

export function getQueryErrorMessage(error, fallback = 'Failed to load data') {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || fallback;
}

export default function QueryErrorBanner({ message, onRetry, className = '' }) {
  return (
    <div
      className={`mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-300 min-w-0">
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
          <RefreshCw size={14} /> Retry
        </Button>
      )}
    </div>
  );
}
