/**
 * Resolve OAuth / frontend base URLs.
 * In production, ignores localhost values from .env when a public fallback exists.
 */

const LOCALHOST_RE = /localhost|127\.0\.0\.1/i;

function isLocalhostUrl(url) {
  if (!url || typeof url !== 'string') return true;
  return LOCALHOST_RE.test(url);
}

function trimUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

/** Public API host for OAuth callbacks (Render). */
function resolveApiBaseUrl(req) {
  if (req) {
    const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    if (host && !LOCALHOST_RE.test(host)) {
      return `${proto}://${host}`;
    }
  }

  const candidates = [
    process.env.SERVER_URL,
    process.env.APP_BASE_URL,
    process.env.TRACKING_BASE_URL,
  ].map(trimUrl).filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    const publicBase = candidates.find((u) => !isLocalhostUrl(u));
    if (publicBase) return publicBase;
  }

  return candidates[0] || 'http://localhost:5000';
}

/** Browser origin for Meta OAuth redirect (Vercel frontend). */
function resolveClientUrl() {
  const candidates = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
  ].map(trimUrl).filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    const publicUrl = candidates.find((u) => !isLocalhostUrl(u));
    if (publicUrl) return publicUrl;
    return 'https://tsccoreknot.com';
  }

  return candidates[0] || 'http://localhost:5173';
}

function resolveOAuthRedirectUri(req, { envVar, path, prodEnvVar }) {
  const explicit = trimUrl(process.env[envVar]);
  if (explicit && !(process.env.NODE_ENV === 'production' && isLocalhostUrl(explicit))) {
    return explicit;
  }

  const prodExplicit = prodEnvVar ? trimUrl(process.env[prodEnvVar]) : '';
  if (process.env.NODE_ENV === 'production' && prodExplicit && !isLocalhostUrl(prodExplicit)) {
    return prodExplicit;
  }

  return `${resolveApiBaseUrl(req)}${path}`;
}

module.exports = {
  isLocalhostUrl,
  resolveApiBaseUrl,
  resolveClientUrl,
  resolveOAuthRedirectUri,
};
