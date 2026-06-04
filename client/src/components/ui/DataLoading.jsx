import React from 'react';
import { Spinner } from './Spinner';

/** Centered spinner + random phrase for tables, panels, and refetches. */
export const DataLoading = ({ className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-10 ${className}`}>
    <Spinner size="md" showPhrase phraseClassName="text-xs text-[var(--color-text-muted)]" />
  </div>
);

export default DataLoading;
