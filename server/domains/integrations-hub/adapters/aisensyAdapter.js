const crypto = require('crypto');

const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

async function validateApiKey(apiKey) {
  const res = await fetch(AISENSY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      campaignName: 'health_check',
      destination: '0000000000',
      userName: 'CoreKnot',
      templateParams: [],
    }),
  });
  const json = await res.json().catch(() => ({}));
  const msg = String(json?.message || json?.error || '').toLowerCase();
  if (res.status === 401 || res.status === 403 || msg.includes('api key') || msg.includes('unauthorized')) {
    throw new Error('Invalid AiSensy API key');
  }
  return { ok: true };
}

module.exports = {
  id: 'aisensy',
  async handleApiKeyConnect({ apiKey }) {
    const trimmed = String(apiKey || '').trim();
    if (!trimmed) throw new Error('API key required');
    await validateApiKey(trimmed);
    const webhookVerifyToken = crypto.randomBytes(16).toString('hex');
    const webhookSecret = crypto.randomBytes(24).toString('base64url');
    return {
      apiKey: trimmed,
      accountId: 'aisensy',
      webhookVerifyToken,
      webhookSecret,
    };
  },
  async healthCheck(credentials) {
    if (!credentials?.apiKey) throw new Error('Missing API key');
    await validateApiKey(credentials.apiKey);
    return { ok: true };
  },
};
