const {
  isVercelAppHost,
  isVercelAppOrigin,
  allowVercelPreviewOrigins,
} = require('../utils/vercelOrigins');

describe('vercelOrigins', () => {
  const restore = () => {
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
    delete process.env.COREKNOT_DEPLOY_TIER;
    delete process.env.RENDER_SERVICE_NAME;
    delete process.env.NODE_ENV;
  };

  afterEach(restore);

  it('detects vercel.app hosts and origins', () => {
    expect(isVercelAppHost('obti37s-projects.vercel.app')).toBe(true);
    expect(isVercelAppHost('tsccoreknot.com')).toBe(false);
    expect(isVercelAppOrigin('https://obti37s-projects.vercel.app')).toBe(true);
  });

  it('blocks vercel previews on strict production unless explicitly enabled', () => {
    process.env.COREKNOT_DEPLOY_TIER = 'production';
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
    expect(allowVercelPreviewOrigins()).toBe(false);
    process.env.CORS_ALLOW_VERCEL_PREVIEWS = 'true';
    expect(allowVercelPreviewOrigins()).toBe(true);
  });

  it('allows vercel previews on staging by default', () => {
    process.env.COREKNOT_DEPLOY_TIER = 'staging';
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
    expect(allowVercelPreviewOrigins()).toBe(true);
    process.env.CORS_ALLOW_VERCEL_PREVIEWS = 'false';
    expect(allowVercelPreviewOrigins()).toBe(false);
  });

  it('allows vercel previews in local development by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.COREKNOT_DEPLOY_TIER;
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
    expect(allowVercelPreviewOrigins()).toBe(true);
  });
});
