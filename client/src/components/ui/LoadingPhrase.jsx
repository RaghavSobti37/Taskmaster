import React from 'react';
import { useLoadingPhrase } from '../../hooks/useLoadingPhrase';

/** Visible loading copy — never generic "Loading..."; phrase held ≥5s via loadingPhraseSession */
export function LoadingPhrase({ phrase: phraseProp, className = '' }) {
  const random = useLoadingPhrase();
  const text = phraseProp ?? random;
  return (
    <p className={`text-sm font-medium text-[var(--color-text-secondary)] text-center max-w-md px-4 ${className}`}>
      {text}
    </p>
  );
}
