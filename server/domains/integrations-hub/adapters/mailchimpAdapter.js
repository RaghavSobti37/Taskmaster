function mailchimpClientCreds() {
  const clientId = (process.env.MAILCHIMP_CLIENT_ID || '').replace(/['"]/g, '').trim();
  const clientSecret = (process.env.MAILCHIMP_CLIENT_SECRET || '').replace(/['"]/g, '').trim();
  return { clientId, clientSecret };
}

function dcFromApiKey(apiKey) {
  const parts = String(apiKey || '').split('-');
  return parts[parts.length - 1] || 'us1';
}

function apiBase(credentials) {
  const dc = credentials.dataCenter || dcFromApiKey(credentials.apiKey);
  return `https://${dc}.api.mailchimp.com/3.0`;
}

function authHeader(credentials) {
  if (credentials.apiKey) {
    return `Basic ${Buffer.from(`anystring:${credentials.apiKey}`).toString('base64')}`;
  }
  return `OAuth ${credentials.accessToken}`;
}

async function exchangeCode({ code, redirectUri }) {
  const { clientId, clientSecret } = mailchimpClientCreds();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch('https://login.mailchimp.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Mailchimp token exchange failed');
  return data;
}

async function fetchMetadata(accessToken) {
  const res = await fetch('https://login.mailchimp.com/oauth2/metadata', {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) throw new Error('Mailchimp metadata fetch failed');
  return res.json();
}

module.exports = {
  id: 'mailchimp',
  getClientCreds: mailchimpClientCreds,
  async handleApiKeyConnect({ apiKey }) {
    const dc = dcFromApiKey(apiKey);
    const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/`, {
      headers: { Authorization: authHeader({ apiKey }) },
    });
    if (!res.ok) throw new Error('Invalid Mailchimp API key');
    const data = await res.json();
    return {
      apiKey,
      dataCenter: dc,
      accountId: data.account_id || dc,
      accountName: data.account_name,
    };
  },
  async handleCallback({ code, redirectUri }) {
    const tokens = await exchangeCode({ code, redirectUri });
    const meta = await fetchMetadata(tokens.access_token);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: null,
      accountId: meta.dc || meta.login?.dc,
      dataCenter: meta.dc,
      apiEndpoint: meta.api_endpoint,
    };
  },
  async healthCheck(credentials) {
    const res = await fetch(`${apiBase(credentials)}/`, {
      headers: { Authorization: authHeader(credentials) },
    });
    if (!res.ok) throw new Error('Mailchimp health check failed');
    const data = await res.json();
    return { ok: true, accountName: data.account_name };
  },
  async listAudiences(credentials) {
    const res = await fetch(`${apiBase(credentials)}/lists?count=100`, {
      headers: { Authorization: authHeader(credentials) },
    });
    if (!res.ok) throw new Error('Failed to list Mailchimp audiences');
    const data = await res.json();
    return data.lists || [];
  },
  async listMembers(credentials, listId, offset = 0) {
    const res = await fetch(
      `${apiBase(credentials)}/lists/${listId}/members?count=100&offset=${offset}&status=subscribed`,
      { headers: { Authorization: authHeader(credentials) } },
    );
    if (!res.ok) throw new Error('Failed to list Mailchimp members');
    return res.json();
  },
};
