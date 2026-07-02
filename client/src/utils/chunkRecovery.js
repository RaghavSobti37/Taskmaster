const RECOVERY_KEY = 'coreknot-chunk-recovery';
const MAX_ATTEMPTS = 2;

export function isStaleChunkError(error) {
  const message = String(error?.message || error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message)
    || /error loading dynamically imported module/i.test(message)
    || /ChunkLoadError/i.test(message)
    || /MIME type/i.test(message)
  );
}

export function isStaleAssetScript(target) {
  return target?.tagName === 'SCRIPT' && target.src && /\.(js|mjs)(\?|$)/i.test(target.src);
}

function readRecoveryState() {
  try {
    return JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeRecoveryState(state) {
  sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
}

export async function clearAppCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

/** Purge SW + caches once or twice, then reload — stops infinite reload loops after deploys. */
export async function recoverFromStaleChunks() {
  const state = readRecoveryState();
  const now = Date.now();
  const attempts = Number(state.attempts || 0);

  if (state.recovering) return false;
  if (attempts >= MAX_ATTEMPTS) return false;
  if (state.lastAttempt && now - state.lastAttempt < 3000) return false;

  writeRecoveryState({ attempts: attempts + 1, lastAttempt: now, recovering: true });
  await clearAppCaches();
  window.location.reload();
  return true;
}

export function markChunkRecoveryComplete() {
  sessionStorage.removeItem(RECOVERY_KEY);
}

export async function hardReloadApp() {
  try {
    await Promise.race([
      clearAppCaches(),
      new Promise((resolve) => { window.setTimeout(resolve, 1500); }),
    ]);
  } catch {
    // ponytail: still reload if SW/cache teardown fails
  }
  markChunkRecoveryComplete();
  window.location.reload();
}
