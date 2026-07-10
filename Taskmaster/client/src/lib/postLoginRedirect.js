/** Prevent double navigation from LoginPage + ClerkSessionBridge. */
import { navigateAfterAuth } from '../utils/authNavigation';

let hasNavigated = false;
let navigatedAt = 0;

const NAVIGATE_GUARD_TTL_MS = 5000;

function isNavigateGuardActive() {
  if (!hasNavigated) return false;
  if (Date.now() - navigatedAt >= NAVIGATE_GUARD_TTL_MS) {
    resetNavigateGuard();
    return false;
  }
  return true;
}

export function navigateOnce(navigate, target) {
  if (isNavigateGuardActive()) return;
  hasNavigated = true;
  navigatedAt = Date.now();
  navigateAfterAuth(navigate, target);
}

export function resetNavigateGuard() {
  hasNavigated = false;
  navigatedAt = 0;
}

export function externalRedirectOnce(targetUrl) {
  if (isNavigateGuardActive()) return;
  hasNavigated = true;
  navigatedAt = Date.now();
  window.location.replace(targetUrl);
}
