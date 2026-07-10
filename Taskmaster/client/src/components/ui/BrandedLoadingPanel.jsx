import React from 'react';
import { Spinner } from './Spinner';

/**
 * In-shell branded loader — same ribbon + phrase as AppBootFallback / BootScreen.
 * Use for route content areas (dashboard shell) while chunks or queries resolve.
 */
export default function BrandedLoadingPanel({ className = '', minHeight = 'min-h-[50vh]' }) {
  return (
    <div
      className={`flex ${minHeight} items-center justify-center px-6 py-16 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Spinner
        size="boot"
        showPhrase
        phraseClassName="text-base sm:text-lg font-medium normal-case tracking-normal text-[var(--color-text-secondary)]"
      />
    </div>
  );
}
