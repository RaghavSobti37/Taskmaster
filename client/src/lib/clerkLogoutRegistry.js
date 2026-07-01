/** Registered by ClerkSessionBridge when Clerk is active. */
let signOutFn = null;

export function registerClerkSignOut(fn) {
  signOutFn = typeof fn === 'function' ? fn : null;
}

export async function runClerkSignOut() {
  if (!signOutFn) return;
  try {
    await signOutFn();
  } catch {
    // CoreKnot cookie logout still runs
  }
}
