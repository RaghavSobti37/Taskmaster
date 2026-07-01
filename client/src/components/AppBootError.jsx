import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/primitives';

/** Full-screen boot failure — refresh instead of infinite spinner. */
export default function AppBootError({
  message = "Couldn't load CoreKnot. Check your connection and try again.",
  onRefresh,
}) {
  const handleRefresh = onRefresh || (() => window.location.reload());

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-workspace)] px-6 text-center"
      role="alert"
    >
      <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-6">
        {message}
      </p>
      <Button type="button" onClick={handleRefresh} className="gap-2">
        <RefreshCw size={14} aria-hidden />
        Refresh
      </Button>
    </div>
  );
}
