const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isVercelAppHost,
  isVercelAppOrigin,
  allowVercelPreviewOrigins,
} = require('../utils/vercelOrigins');

describe('vercelOrigins', () => {
  it('detects vercel.app hosts and origins', () => {
    assert.equal(isVercelAppHost('obti37s-projects.vercel.app'), true);
    assert.equal(isVercelAppHost('tsccoreknot.com'), false);
    assert.equal(
      isVercelAppOrigin('https://obti37s-projects.vercel.app'),
      true,
    );
  });

  it('allows vercel previews unless explicitly disabled', () => {
    const prev = process.env.CORS_ALLOW_VERCEL_PREVIEWS;
    try {
      delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
      assert.equal(allowVercelPreviewOrigins(), true);
      process.env.CORS_ALLOW_VERCEL_PREVIEWS = 'false';
      assert.equal(allowVercelPreviewOrigins(), false);
    } finally {
      if (prev === undefined) delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
      else process.env.CORS_ALLOW_VERCEL_PREVIEWS = prev;
    }
  });
});
