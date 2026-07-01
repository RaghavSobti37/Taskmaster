import React from 'react';

/** Displays one loading phrase with shimmer (transitions.dev shimmer-text). */
export function LoadingPhrase({ phrase, className = '' }) {
  if (!phrase) return null;
  return (
    <p
      className={`t-shimmer text-sm font-medium text-center max-w-md px-4 ${className}`}
      data-text={phrase}
    >
      {phrase}
    </p>
  );
}
