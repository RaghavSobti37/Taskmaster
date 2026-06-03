const crypto = require('crypto');

/**
 * Parse Meta signed_request (Facebook Login / data deletion callback).
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || !appSecret) {
    throw new Error('Missing signed_request or app secret');
  }

  const parts = String(signedRequest).split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid signed_request format');
  }

  const [encodedSig, payload] = parts;
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const data = JSON.parse(
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  );

  if (data.algorithm?.toUpperCase() !== 'HMAC-SHA256') {
    throw new Error('Unsupported signed_request algorithm');
  }

  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    throw new Error('Invalid signed_request signature');
  }

  return data;
}

module.exports = { parseSignedRequest };
