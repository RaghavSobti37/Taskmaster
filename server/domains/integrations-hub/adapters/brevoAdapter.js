module.exports = {
  id: 'brevo',
  async handleApiKeyConnect({ apiKey }) {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey },
    });
    if (!res.ok) throw new Error('Invalid Brevo API key');
    const data = await res.json();
    return { apiKey, accountId: String(data.userId || data.email || 'brevo'), email: data.email };
  },
  async healthCheck(credentials) {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': credentials.apiKey },
    });
    if (!res.ok) throw new Error('Brevo health check failed');
    return { ok: true };
  },
};
