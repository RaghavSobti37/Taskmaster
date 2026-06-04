import { useEffect, useState } from 'react';
import { acquireLoadingPhrase, MIN_LOADING_PHRASE_MS } from '../lib/loadingPhraseSession';

/**
 * Loading copy — same phrase for ≥5s app-wide; rotates only after lock expires while still mounted.
 */
export function useLoadingPhrase() {
  const [phrase, setPhrase] = useState(() => acquireLoadingPhrase());

  useEffect(() => {
    const id = setInterval(() => {
      setPhrase((prev) => {
        const next = acquireLoadingPhrase();
        return next === prev ? prev : next;
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  return phrase;
}

export { MIN_LOADING_PHRASE_MS };
