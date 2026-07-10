import { authUrl, usesExternalAuthHost } from '../config/siteUrls';

let cachedOrgFirst = null;

/** Client mirror of server CLERK_ORG_FIRST_AUTH — env wins when set. */
export function isOrgFirstAuthEnabled() {
  const envFlag = String(import.meta.env.VITE_ORG_FIRST_AUTH || '').trim().toLowerCase();
  if (envFlag === 'true') return true;
  if (envFlag === 'false') return false;
  return cachedOrgFirst === true;
}

export function setOrgFirstAuthFromConfig(cfg) {
  if (typeof cfg?.orgFirstAuth === 'boolean') {
    cachedOrgFirst = cfg.orgFirstAuth;
  }
}

export async function loadOrgFirstAuthConfig() {
  try {
    const response = await fetch('/api/auth/config');
    if (!response.ok) return;
    const cfg = await response.json();
    setOrgFirstAuthFromConfig(cfg);
  } catch {
    // ponytail: 409 handler falls back to legacy /org/pick when config unavailable
  }
}

/** Clerk org picker route — replaces custom /org/pick when org-first is on. */
export function clerkOrgSelectionUrl() {
  const choosePath = '/login/choose';
  return usesExternalAuthHost() ? authUrl(choosePath) : choosePath;
}
