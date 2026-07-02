/** Prevent double navigation from LoginPage + ClerkSessionBridge. */
import { navigateAfterAuth } from '../utils/authNavigation';

let hasNavigated = false;

export function navigateOnce(navigate, target) {
  if (hasNavigated) return;
  hasNavigated = true;
  navigateAfterAuth(navigate, target);
}

export function resetNavigateGuard() {
  hasNavigated = false;
}

export function externalRedirectOnce(targetUrl) {
  if (hasNavigated) return;
  hasNavigated = true;
  window.location.replace(targetUrl);
}
