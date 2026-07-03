import React, { useEffect, useState } from 'react';
import AppBootFallback from './AppBootFallback';
import AppBootError from './AppBootError';

const DEFAULT_BOOT_TIMEOUT_MS = 18000;

/** Spinner while booting; error + refresh after timeout or explicit bootError. */
export default function BootScreen({
  bootError = null,
  timeoutMs = DEFAULT_BOOT_TIMEOUT_MS,
  onRefresh,
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (bootError) {
      setTimedOut(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [bootError, timeoutMs]);

  if (bootError) {
    return <AppBootError bootError={bootError} onRefresh={onRefresh} />;
  }

  if (timedOut) {
    return (
      <AppBootError
        summary="Loading is taking too long. Check your connection and try again."
        onRefresh={onRefresh}
      />
    );
  }

  return <AppBootFallback />;
}
