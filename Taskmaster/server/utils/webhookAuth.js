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
    return { ok: false, error: 'Webhook secret not configured' };
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

const verifyBookCallWebhookSecret = (req) => {
  const secret = process.env.BOOK_CALL_WEBHOOK_SECRET;
  if (!secret) {
    return false;
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

const verifyArtistPathWebhookSecret = (req) => {
  const secret = process.env.ARTIST_PATH_WEBHOOK_SECRET;
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

const rejectUnlessBookCallAuthorized = (req, res) => {
  if (verifyBookCallWebhookSecret(req)) return true;
  return rejectUnlessWebhookSignature(req, res, 'BOOK_CALL_WEBHOOK_SECRET');
};

const rejectUnlessArtistPathAuthorized = (req, res) => {
  if (verifyArtistPathWebhookSecret(req)) return true;
  return rejectUnlessWebhookSignature(req, res, 'ARTIST_PATH_WEBHOOK_SECRET');
};

const verifySecretHeader = (req, secretEnvKey) => {
  const secret = process.env[secretEnvKey];
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

const verifyNewsletterWebhookSecret = (req) => verifySecretHeader(req, 'NEWSLETTER_WEBHOOK_SECRET');
const verifyMasterclassReviewWebhookSecret = (req) => verifySecretHeader(req, 'MASTERCLASS_REVIEW_WEBHOOK_SECRET');

const rejectUnlessNewsletterAuthorized = (req, res) => {
  if (verifyNewsletterWebhookSecret(req)) return true;
  res.status(401).json({ success: false, error: 'Unauthorized' });
  return false;
};

const rejectUnlessMasterclassReviewAuthorized = (req, res) => {
  if (verifyMasterclassReviewWebhookSecret(req)) return true;
  res.status(401).json({ success: false, error: 'Unauthorized' });
  return false;
};

module.exports = {
  computeWebhookSignature,
  verifyWebhookSignature,
  rejectUnlessWebhookSignature,
  verifyArtistEnquirySecret,
  verifyBookCallWebhookSecret,
  verifyArtistPathWebhookSecret,
  verifyNewsletterWebhookSecret,
  verifyMasterclassReviewWebhookSecret,
  rejectUnlessBookCallAuthorized,
  rejectUnlessArtistPathAuthorized,
  rejectUnlessNewsletterAuthorized,
  rejectUnlessMasterclassReviewAuthorized,
};
