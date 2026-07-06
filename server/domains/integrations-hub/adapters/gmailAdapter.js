const crypto = require('crypto');

function googleClientCreds() {
  const clientId = (
    process.env.INTEGRATIONS_GOOGLE_CLIENT_ID
    || process.env.GOOGLE_CLIENT_ID
    || process.env.YOUTUBE_CLIENT_ID
    || ''
  ).replace(/['"]/g, '').trim();
  const clientSecret = (
    process.env.INTEGRATIONS_GOOGLE_CLIENT_SECRET
    || process.env.GOOGLE_CLIENT_SECRET
    || process.env.YOUTUBE_CLIENT_SECRET
    || ''
  ).replace(/['"]/g, '').trim();
  return { clientId, clientSecret };
}

async function exchangeCode({ code, redirectUri }) {
  const { clientId, clientSecret } = googleClientCreds();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Google token exchange failed');
  return data;
}

async function refreshToken(credentials) {
  const { clientId, clientSecret } = googleClientCreds();
  if (!credentials?.refreshToken) throw new Error('No refresh token');
  const body = new URLSearchParams({
    refresh_token: credentials.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Google refresh failed');
  return {
    ...credentials,
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : credentials.expiresAt,
  };
}

async function fetchProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google profile');
  return res.json();
}

module.exports = {
  id: 'gmail',
  getClientCreds: googleClientCreds,
  async handleCallback({ code, redirectUri }) {
    const tokens = await exchangeCode({ code, redirectUri });
    const profile = await fetchProfile(tokens.access_token);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      accountId: profile.email || profile.id,
      email: profile.email,
      scopes: String(tokens.scope || '').split(' ').filter(Boolean),
    };
  },
  refreshToken,
  async healthCheck(credentials) {
    const profile = await fetchProfile(credentials.accessToken);
    return { ok: true, email: profile.email };
  },
  async sendEmail(credentials, { to, subject, html, from }) {
    const boundary = `ck_${crypto.randomBytes(8).toString('hex')}`;
    const toList = Array.isArray(to) ? to : [to];
    const sender = from || credentials.email;
    const raw = [
      `From: ${sender}`,
      `To: ${toList.join(', ')}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: text/html; charset=utf-8`,
      '',
      html,
    ].join('\r\n');
    const encoded = Buffer.from(raw).toString('base64url');
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Gmail send failed');
    return data;
  },
};
