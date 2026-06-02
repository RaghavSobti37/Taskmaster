const crypto = require('crypto');

const computeWebhookSignature = (rawBody, secret) => {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
};

const verifyWebhookSignature = (req, secretEnvKey) => {
  const header = req.headers['x-webhook-signature'] || req.headers['x-hub-signature-256'];
  if (!header) {
    return { ok: false, error: 'Missing X-Webhook-Signature header' };
  }

  const secret = process.env[secretEnvKey];
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, error: 'Webhook secret not configured' };
    }
    return { ok: true, skipped: true };
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return { ok: false, error: 'Missing raw request body for signature verification' };
  }

  const expected = computeWebhookSignature(rawBody, secret);
  const received = String(header).trim();

  try {
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(received);
    if (expectedBuf.length !== receivedBuf.length) {
      return { ok: false, error: 'Invalid webhook signature' };
    }
    const valid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
    return valid ? { ok: true } : { ok: false, error: 'Invalid webhook signature' };
  } catch {
    return { ok: false, error: 'Invalid webhook signature' };
  }
};

const rejectUnlessWebhookSignature = (req, res, secretEnvKey) => {
  const result = verifyWebhookSignature(req, secretEnvKey);
  if (!result.ok) {
    res.status(401).json({ success: false, error: result.error || 'Unauthorized' });
    return false;
  }
  return true;
};

const verifyArtistEnquirySecret = (req) => {
  const secret = process.env.ARTIST_ENQUIRY_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const received = req.headers['x-webhook-secret'];
  if (!received || typeof received !== 'string') return false;
  try {
    const a = Buffer.from(received.trim());
    const b = Buffer.from(secret.trim());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

module.exports = {
  computeWebhookSignature,
  verifyWebhookSignature,
  rejectUnlessWebhookSignature,
  verifyArtistEnquirySecret,
};
