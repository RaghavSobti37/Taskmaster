const crypto = require('crypto');

function generateWebhookSecret() {
  const raw = crypto.randomBytes(24).toString('base64url');
  return { secret: `whin_${raw}`, prefix: `whin_${raw.slice(0, 8)}` };
}

function verifySignature(secret, body, signature) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const provided = String(signature).replace(/^sha256=/, '');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return expected === provided;
  }
}

module.exports = {
  id: 'webhook_in',
  generateWebhookSecret,
  verifySignature,
};
