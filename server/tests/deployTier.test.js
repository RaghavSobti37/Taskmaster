const {
  getDeployTier,
  isStrictProduction,
  isStagingDeploy,
  getDefaultJsonBodyLimit,
} = require('../utils/deployTier');

describe('deployTier', () => {
  const restore = () => {
    delete process.env.COREKNOT_DEPLOY_TIER;
    delete process.env.RENDER_SERVICE_NAME;
    delete process.env.NODE_ENV;
  };

  afterEach(restore);

  it('infers staging from Render service name', () => {
    process.env.RENDER_SERVICE_NAME = 'coreknot-api-staging';
    expect(getDeployTier()).toBe('staging');
    expect(isStagingDeploy()).toBe(true);
    expect(isStrictProduction()).toBe(false);
  });

  it('infers production from Render service name', () => {
    process.env.RENDER_SERVICE_NAME = 'CoreKnot-api';
    expect(getDeployTier()).toBe('production');
    expect(isStrictProduction()).toBe(true);
  });

  it('uses explicit COREKNOT_DEPLOY_TIER when set', () => {
    process.env.RENDER_SERVICE_NAME = 'coreknot-api-staging';
    process.env.COREKNOT_DEPLOY_TIER = 'production';
    expect(getDeployTier()).toBe('production');
  });

  it('defaults JSON body limit by tier', () => {
    process.env.COREKNOT_DEPLOY_TIER = 'development';
    expect(getDefaultJsonBodyLimit()).toBe('10mb');
    process.env.COREKNOT_DEPLOY_TIER = 'staging';
    expect(getDefaultJsonBodyLimit()).toBe('50mb');
    process.env.COREKNOT_DEPLOY_TIER = 'production';
    expect(getDefaultJsonBodyLimit()).toBe('50mb');
  });
});
