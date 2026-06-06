import { pickRandomLoadingPhrase } from './loadingPhrases';

/** Minimum time each phrase stays visible (ms) */
export const MIN_LOADING_PHRASE_MS = 5000;

let session = {
  phrase: null,
  lockedUntil: 0,
};

/** Shared phrase for all loaders; new phrase only after lock expires */
export function acquireLoadingPhrase() {
  const now = Date.now();
  if (!session.phrase || now >= session.lockedUntil) {
    session.phrase = pickRandomLoadingPhrase();
    session.lockedUntil = now + MIN_LOADING_PHRASE_MS;
  }
  return session.phrase;
}

/** For tests / dev only */
function resetLoadingPhraseSession() {
  session = { phrase: null, lockedUntil: 0 };
}
