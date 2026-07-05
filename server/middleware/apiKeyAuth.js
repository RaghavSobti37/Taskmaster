const { verifyApiKey } = require('../services/tenantApiKeyService');

/** Bearer ck_live_* tenant API key auth — sets req.tenantId + req.apiKeyScopes */
const apiKeyAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'API key required', code: 'API_KEY_REQUIRED' });
  }
  const row = await verifyApiKey(match[1].trim());
  if (!row) {
    return res.status(401).json({ error: 'Invalid API key', code: 'API_KEY_INVALID' });
  }
  req.tenantId = row.tenantId;
  req.apiKeyScopes = row.scopes || [];
  req.authViaApiKey = true;
  return next();
};

module.exports = { apiKeyAuth };
