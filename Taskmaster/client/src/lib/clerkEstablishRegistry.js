/** Clerk → CoreKnot establish failure surfaced on login (ClerkSessionBridge → LoginPage). */
const listeners = new Set();
let lastError = null;

export function subscribeClerkEstablishError(listener) {
  listeners.add(listener);
  listener(lastError);
  return () => listeners.delete(listener);
}

export function setClerkEstablishError(error) {
  lastError = error || null;
  listeners.forEach((fn) => fn(lastError));
}

export function clearClerkEstablishError() {
  setClerkEstablishError(null);
}
