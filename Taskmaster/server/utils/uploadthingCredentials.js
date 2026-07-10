/** Resolve UploadThing API key from UPLOADTHING_TOKEN (v7) with UPLOADTHING_SECRET fallback. */
function parseUploadthingToken(raw) {
  const cleaned = String(raw || '').trim().replace(/^"|"$/g, '');
  if (!cleaned) return null;
  try {
    return JSON.parse(Buffer.from(cleaned, 'base64').toString());
  } catch {
    return null;
  }
}

function resolveUploadthingApiKey() {
  const tokenData = parseUploadthingToken(process.env.UPLOADTHING_TOKEN);
  if (tokenData?.apiKey) return tokenData.apiKey;
  return process.env.UPLOADTHING_SECRET || null;
}

function validateUploadthingCredentials() {
  const tokenData = parseUploadthingToken(process.env.UPLOADTHING_TOKEN);
  const secret = process.env.UPLOADTHING_SECRET || '';
  const apiKey = resolveUploadthingApiKey();

  if (!apiKey) {
    return { ok: false, message: 'Missing UPLOADTHING_TOKEN or UPLOADTHING_SECRET — file uploads will fail' };
  }

  if (tokenData?.apiKey && secret && tokenData.apiKey !== secret) {
    return {
      ok: false,
      message: 'UPLOADTHING_TOKEN apiKey does not match UPLOADTHING_SECRET — ingest uploads return 400 Invalid signature',
    };
  }

  return {
    ok: true,
    appId: tokenData?.appId || process.env.UPLOADTHING_APP_ID || null,
    keyFingerprint: fingerprintApiKey(apiKey),
  };
}

/** Safe prefix/suffix for health checks — never log full keys. */
function fingerprintApiKey(apiKey) {
  const key = String(apiKey || '');
  if (key.length < 12) return null;
  return `${key.slice(0, 8)}…${key.slice(-6)}`;
}

module.exports = {
  parseUploadthingToken,
  resolveUploadthingApiKey,
  validateUploadthingCredentials,
  fingerprintApiKey,
};
