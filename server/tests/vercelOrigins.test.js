const {
  isVercelAppHost,
  isVercelAppOrigin,
  allowVercelPreviewOrigins,
} = require('../utils/vercelOrigins');

describe('vercelOrigins', () => {
  it('detects vercel.app hosts and origins', () => {
    expect(isVercelAppHost('obti37s-projects.vercel.app')).toBe(true);
    expect(isVercelAppHost('tsccoreknot.com')).toBe(false);
    expect(isVercelAppOrigin('https://obti37s-projects.vercel.app')).toBe(true);
  });

  it('allows vercel previews unless explicitly disabled', () => {
    const prev = process.env.CORS_ALLOW_VERCEL_PREVIEWS;
    try {
      delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
      expect(allowVercelPreviewOrigins()).toBe(true);
      process.env.CORS_ALLOW_VERCEL_PREVIEWS = 'false';
      expect(allowVercelPreviewOrigins()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
      else process.env.CORS_ALLOW_VERCEL_PREVIEWS = prev;
    }
  });
});
