import { useState } from 'react';
import { pickRandomLoadingPhrase } from '../lib/loadingPhrases';

/**
 * One humorous phrase per mount — fixed until unmount. No rotation while loading.
 * Use only with full-screen / large loaders (Spinner showPhrase, LoadingState showPhrase).
 */
export function useLoadingPhrase() {
  const [phrase] = useState(() => pickRandomLoadingPhrase());
  return phrase;
}
