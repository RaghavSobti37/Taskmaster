function hubspotClientCreds() {
  const clientId = (process.env.HUBSPOT_CLIENT_ID || '').replace(/['"]/g, '').trim();
  const clientSecret = (process.env.HUBSPOT_CLIENT_SECRET || '').replace(/['"]/g, '').trim();
  return { clientId, clientSecret };
}

async function exchangeCode({ code, redirectUri }) {
  const { clientId, clientSecret } = hubspotClientCreds();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'HubSpot token exchange failed');
  return data;
}

async function refreshToken(credentials) {
  const { clientId, clientSecret } = hubspotClientCreds();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: credentials.refreshToken,
  });
  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'HubSpot refresh failed');
  return {
    ...credentials,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || credentials.refreshToken,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : credentials.expiresAt,
  };
}

module.exports = {
  id: 'hubspot',
  getClientCreds: hubspotClientCreds,
  async handleCallback({ code, redirectUri }) {
    const tokens = await exchangeCode({ code, redirectUri });
    const infoRes = await fetch(
      `https://api.hubapi.com/oauth/v1/access-tokens/${tokens.access_token}`,
    );
    const info = infoRes.ok ? await infoRes.json() : {};
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      accountId: String(info.hub_id || info.user || 'hubspot'),
      hubId: info.hub_id,
      userEmail: info.user,
    };
  },
  refreshToken,
  async healthCheck(credentials) {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (!res.ok) throw new Error('HubSpot health check failed');
    return { ok: true };
  },
  async listContacts(credentials, after) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', 'email,firstname,lastname,phone,company,lifecyclestage');
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (!res.ok) throw new Error('HubSpot list contacts failed');
    return res.json();
  },
  async createContact(credentials, properties) {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'HubSpot create contact failed');
    }
    return res.json();
  },
};
