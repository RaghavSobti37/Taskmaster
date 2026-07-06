function slackClientCreds() {
  const clientId = (process.env.SLACK_CLIENT_ID || '').replace(/['"]/g, '').trim();
  const clientSecret = (process.env.SLACK_CLIENT_SECRET || '').replace(/['"]/g, '').trim();
  return { clientId, clientSecret };
}

module.exports = {
  id: 'slack',
  getClientCreds: slackClientCreds,
  async handleCallback({ code, redirectUri }) {
    const { clientId, clientSecret } = slackClientCreds();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Slack OAuth failed');
    return {
      accessToken: data.access_token,
      accountId: data.team?.id || 'slack',
      teamName: data.team?.name,
      webhookUrl: data.incoming_webhook?.url,
    };
  },
  async healthCheck(credentials) {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Slack health check failed');
    return { ok: true, team: data.team };
  },
  async sendNotification(credentials, { text, channel }) {
    if (credentials.webhookUrl) {
      const res = await fetch(credentials.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Slack webhook send failed');
      return { ok: true };
    }
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: channel || '#general', text }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Slack message failed');
    return data;
  },
};
