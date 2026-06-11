/**
 * Client-side keep-warm while app is open and user is logged in.
 * Complements GitHub Actions smart keep-warm — pings /api/health after idle
 * period with no API activity (tab must be visible).
 */

const IDLE_MINUTES = 7;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const HEALTH_PATH = '/api/health';

let lastActivityAt = Date.now();
let idleTimer = null;
let active = false;
let inFlight = false;

export function touchKeepWarmActivity() {
  lastActivityAt = Date.now();
  scheduleIdlePing();
}

function clearIdleTimer() {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
}

async function pingHealth() {
  if (inFlight || document.visibilityState !== 'visible') return;
  inFlight = true;
  try {
    await fetch(HEALTH_PATH, { method: 'GET', credentials: 'include', cache: 'no-store' });
  } catch {
    // Non-fatal — GHA checker is primary
  } finally {
    inFlight = false;
    lastActivityAt = Date.now();
    scheduleIdlePing();
  }
}

function scheduleIdlePing() {
  if (!active) return;
  clearIdleTimer();
  const elapsed = Date.now() - lastActivityAt;
  const delay = Math.max(0, IDLE_MS - elapsed);
  idleTimer = window.setTimeout(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastActivityAt >= IDLE_MS) {
      pingHealth();
    } else {
      scheduleIdlePing();
    }
  }, delay);
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && active) {
    scheduleIdlePing();
  } else {
    clearIdleTimer();
  }
}

/**
 * Start idle keep-warm watcher. Call once when user session is active.
 * @param {{ enabled?: boolean }} options
 * @returns {() => void} cleanup
 */
export function startIdleKeepWarm({ enabled = true } = {}) {
  if (!enabled || typeof window === 'undefined') {
    return () => {};
  }

  active = true;
  lastActivityAt = Date.now();
  document.addEventListener('visibilitychange', onVisibilityChange);
  scheduleIdlePing();

  return () => {
    active = false;
    clearIdleTimer();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
