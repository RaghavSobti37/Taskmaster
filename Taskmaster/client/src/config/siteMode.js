import { getRuntimeHostname } from '../utils/runtimeEnv';

const AUTH_HOST = 'auth.tsccoreknot.com';
const LANDING_HOST = 'landing.tsccoreknot.com';

/** Deploy target: app (tsccoreknot.com) | landing | auth — runtime hostname fallback when build env missing. */
const mode = () => {
  const fromEnv = String(import.meta.env.VITE_SITE_MODE || '').trim();
  if (fromEnv && fromEnv !== 'app') return fromEnv;
  const host = getRuntimeHostname();
  if (host === AUTH_HOST) return 'auth';
  if (host === LANDING_HOST) return 'landing';
  return fromEnv || 'app';
};

export const SITE_MODE = mode();

export const isAppSite = () => mode() === 'app';
export const isLandingSite = () => mode() === 'landing';
export const isAuthSite = () => mode() === 'auth';
