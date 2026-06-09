import React from 'react';

/** Displays one loading phrase (caller picks via useLoadingPhrase — full-screen / heavy loaders only). */
export function LoadingPhrase({ phrase, className = '' }) {
  if (!phrase) return null;
  return (
    <p className={`text-sm font-medium text-[var(--color-text-secondary)] text-center max-w-md px-4 ${className}`}>
      {phrase}
    </p>
  );
}
