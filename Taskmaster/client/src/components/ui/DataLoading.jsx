import React from 'react';
import { Spinner } from './Spinner';

/** Centered spinner for tables, panels, refetches. Phrase only when showPhrase. */
export const DataLoading = ({ className = '', showPhrase = false }) => (
  <div className={`flex flex-col items-center justify-center py-10 ${className}`}>
    <Spinner
      size="md"
      showPhrase={showPhrase}
      phraseClassName="text-xs text-[var(--color-text-muted)]"
    />
  </div>
);
