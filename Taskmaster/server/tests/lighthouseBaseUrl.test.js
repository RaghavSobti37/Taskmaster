const { resolveLhBaseUrl } = require('../services/qa/qaLighthouseRunner');

describe('resolveLhBaseUrl', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    jest.resetModules();
  });

  test('uses FRONTEND_URL on hosted production runtime when LH_BASE_URL unset', () => {
    delete process.env.LH_BASE_URL;
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.FRONTEND_URL = 'https://tsccoreknot.com';
    jest.resetModules();
    const { resolveLhBaseUrl: resolve } = require('../services/qa/qaLighthouseRunner');
    expect(resolve()).toBe('https://tsccoreknot.com');
  });

  test('defaults to localhost preview in development', () => {
    delete process.env.LH_BASE_URL;
    delete process.env.RENDER;
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const { resolveLhBaseUrl: resolve } = require('../services/qa/qaLighthouseRunner');
    expect(resolve()).toBe('http://localhost:5173');
  });
});
