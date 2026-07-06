/**
 * Runtime environment — never treat production hosts as local dev based on
 * import.meta.env.DEV alone (wrong build / vercel dev / hosts hacks).
 */

export function getRuntimeHostname() {
  if (typeof window === 'undefined') return '';
  return String(window.location?.hostname || '').toLowerCase();
}

export function isLocalHostname(hostname = getRuntimeHostname()) {
  const host = String(hostname || '').toLowerCase();
  return !host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

/** Production CoreKnot hosts — must not use Vite proxy / dev-only code paths. */
export function isProductionAppHost(hostname = getRuntimeHostname()) {
  const host = String(hostname || '').toLowerCase();
  if (!host || isLocalHostname(host)) return false;
  if (host.endsWith('.vercel.app') || host.includes('onrender.com')) return false;
  return host === 'tsccoreknot.com'
    || host.endsWith('.tsccoreknot.com');
}

/**
 * True only on local Vite dev (localhost + DEV flag).
 * Production domain with a mis-built DEV=true bundle still returns false.
 */
export function isLocalViteDev() {
  if (!import.meta.env.DEV) return false;
  return isLocalHostname();
}
