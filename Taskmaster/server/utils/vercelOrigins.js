function isVercelAppHost(host) {
  const value = String(host || '').toLowerCase().trim();
  return value.endsWith('.vercel.app');
}

function isVercelAppOrigin(origin) {
  if (!origin) return false;
  try {
    return isVercelAppHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Strict production blocks previews unless CORS_ALLOW_VERCEL_PREVIEWS=true; staging/dev allow by default. */
function allowVercelPreviewOrigins() {
  const flag = String(process.env.CORS_ALLOW_VERCEL_PREVIEWS || '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  const { isStrictProduction } = require('./deployTier');
  return !isStrictProduction();
}

module.exports = {
  isVercelAppHost,
  isVercelAppOrigin,
  allowVercelPreviewOrigins,
};
