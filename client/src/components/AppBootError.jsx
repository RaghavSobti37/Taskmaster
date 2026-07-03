import React, { useMemo } from 'react';
import AppErrorPage from './AppErrorPage';
import { resolveAppErrorPresentation } from '../utils/routeErrorPresentation';

/** Full-screen boot failure — delegates to shared AppErrorPage. */
export default function AppBootError({
  bootError = null,
  message,
  error = null,
  statusCode = null,
  capturedAt,
  showHealthyBadge,
  onRefresh,
}) {
  const props = useMemo(() => {
    if (bootError && typeof bootError === 'object') {
      return resolveAppErrorPresentation({
        summary: bootError.summary,
        error: bootError.error || error,
        statusCode: bootError.statusCode ?? statusCode,
        capturedAt: bootError.capturedAt ?? capturedAt,
        showHealthyBadge: bootError.showHealthyBadge ?? showHealthyBadge,
      });
    }

    return resolveAppErrorPresentation({
      summary: message || (typeof bootError === 'string' ? bootError : undefined),
      error,
      statusCode,
      capturedAt,
      showHealthyBadge,
    });
  }, [bootError, message, error, statusCode, capturedAt, showHealthyBadge]);

  return (
    <AppErrorPage
      {...props}
      onRetry={onRefresh || (() => window.location.reload())}
    />
  );
}
