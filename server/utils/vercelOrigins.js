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

/** Default on — set CORS_ALLOW_VERCEL_PREVIEWS=false to block *.vercel.app in production. */
function allowVercelPreviewOrigins() {
  return String(process.env.CORS_ALLOW_VERCEL_PREVIEWS || '').trim() !== 'false';
}

module.exports = {
  isVercelAppHost,
  isVercelAppOrigin,
  allowVercelPreviewOrigins,
};
