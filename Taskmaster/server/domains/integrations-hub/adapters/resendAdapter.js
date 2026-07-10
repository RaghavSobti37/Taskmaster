module.exports = {
  id: 'resend',
  async handleApiKeyConnect({ apiKey }) {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok && res.status !== 403) throw new Error('Invalid Resend API key');
    return { apiKey, accountId: 'resend' };
  },
  async healthCheck(credentials) {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${credentials.apiKey}` },
    });
    if (!res.ok && res.status !== 403) throw new Error('Resend health check failed');
    return { ok: true };
  },
};
