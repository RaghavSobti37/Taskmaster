import React from 'react';
import { Spinner } from './Spinner';

/** Centered spinner for tables, panels, and refetches. */
export const DataLoading = ({ message = 'Loading data...', className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 py-10 ${className}`}>
    <Spinner size="md" />
    <p className="text-xs text-[var(--color-text-muted)]">{message}</p>
  </div>
);

export default DataLoading;
