import React from 'react';
import { Spinner } from './ui/Spinner';

/** Full-screen boot — large spinner + random phrase only (no logo) */
export default function AppBootFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[var(--color-bg-workspace)] px-6"
      role="status"
      aria-live="polite"
    >
      <Spinner
        size="boot"
        showPhrase
        phraseClassName="text-base sm:text-lg font-medium normal-case tracking-normal text-[var(--color-text-secondary)]"
      />
    </div>
  );
}
