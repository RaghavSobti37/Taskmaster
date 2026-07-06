const jwt = require('jsonwebtoken');
const { resolveOAuthRedirectUri } = require('../../../utils/oauthEnv');

function signIntegrationOAuthState({ tenantId, provider, userId, returnUrl }) {
  return jwt.sign(
    {
      tenantId: String(tenantId),
      provider,
      userId: String(userId),
      returnUrl: returnUrl || null,
      purpose: 'integration_oauth',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );
}

function verifyIntegrationOAuthState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== 'integration_oauth') {
    throw new Error('Invalid OAuth state purpose');
  }
  return payload;
}

function integrationCallbackUri(req, provider) {
  return resolveOAuthRedirectUri(req, {
    envVar: `INTEGRATION_${provider.toUpperCase()}_REDIRECT_URI`,
    path: `/api/integrations/oauth/callback/${provider}`,
  });
}

function buildOAuthUrl(providerConfig, { clientId, redirectUri, state, extraParams = {} }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    ...extraParams,
  });
  if (providerConfig.oauthConfig?.scopes?.length) {
    params.set('scope', providerConfig.oauthConfig.scopes.join(' '));
  }
  return `${providerConfig.oauthConfig.authUrl}?${params}`;
}

module.exports = {
  signIntegrationOAuthState,
  verifyIntegrationOAuthState,
  integrationCallbackUri,
  buildOAuthUrl,
};
