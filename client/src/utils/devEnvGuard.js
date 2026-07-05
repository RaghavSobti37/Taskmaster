import { isViteProxyDev } from './apiBase';
import { isClerkLiveKey } from '../config/clerk';

const PROD_API_PATTERNS = [/render\.com/i, /onrender\.com/i, /tsccoreknot\.com/i];

/**
 * Warn when Vite dev server is configured to call a production API host.
 * Relative /api requests (no VITE_API_URL) use vite.config.js proxy → localhost:5000.
 */
export function warnIfDevPointsAtProduction() {
  if (!import.meta.env.DEV) return;

  const apiUrl = (import.meta.env.VITE_API_URL || '').trim();

  if (isClerkLiveKey()) {
    console.error(
      '[DEV GUARD] VITE_CLERK_PUBLISHABLE_KEY is pk_live_ (production). ' +
      'Clerk blocks localhost. Use pk_test_ from client/.env.development and restart vite. ' +
      'If you used vercel dev, run npm run dev instead or unset production Clerk env vars.'
    );
  }

  if (!apiUrl) {
    console.info('[DEV] API: Vite proxy /api → http://localhost:5000');
    return;
  }

  const isProdHost = PROD_API_PATTERNS.some((re) => re.test(apiUrl));
  if (isProdHost) {
    console.error(
      `[DEV GUARD] VITE_API_URL=${apiUrl} points at production. ` +
      'Local UI writes to production DB. Fix client/.env: VITE_API_URL=http://localhost:5000 then restart vite.'
    );
    return;
  }

  if (isViteProxyDev()) {
    console.info(`[DEV] API: Vite proxy /api → http://localhost:5000 (${apiUrl} in .env ignored for axios/socket)`);
    return;
  }
  console.info(`[DEV] API: ${apiUrl}`);
}
