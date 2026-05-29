import React from 'react';
import { Loader2 } from 'lucide-react';

const sizes = {
  sm: 14,
  md: 20,
  lg: 28,
};

/**
 * Spinner — inline loading indicator.
 */
export const Spinner = ({ size = 'md', className = '', label = 'Loading' }) => (
  <Loader2
    size={sizes[size] || sizes.md}
    className={`animate-spin text-[var(--color-action-primary)] ${className}`}
    aria-label={label}
    role="status"
  />
);

/**
 * LoadingState — centered loading block for page sections.
 */
export const LoadingState = ({ message = 'Loading...', className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}>
    <Spinner size="lg" />
    <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
      {message}
    </p>
  </div>
);

export default Spinner;
