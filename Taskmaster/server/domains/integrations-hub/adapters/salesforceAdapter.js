function salesforceClientCreds() {
  const clientId = (process.env.SALESFORCE_CLIENT_ID || '').replace(/['"]/g, '').trim();
  const clientSecret = (process.env.SALESFORCE_CLIENT_SECRET || '').replace(/['"]/g, '').trim();
  return { clientId, clientSecret };
}

module.exports = {
  id: 'salesforce',
  getClientCreds: salesforceClientCreds,
  async handleCallback({ code, redirectUri }) {
    const { clientId, clientSecret } = salesforceClientCreds();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || 'Salesforce token exchange failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
      accountId: data.id?.split('/').pop() || 'salesforce',
      expiresAt: null,
    };
  },
  async healthCheck(credentials) {
    const base = credentials.instanceUrl || 'https://login.salesforce.com';
    const res = await fetch(`${base}/services/data/v59.0/`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (!res.ok) throw new Error('Salesforce health check failed');
    return { ok: true };
  },
};
