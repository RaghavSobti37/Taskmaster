jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('config JWT_SECRET', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('requires JWT_SECRET when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    const { loadConfig } = require('../config/index');
    expect(() => loadConfig()).toThrow(/JWT_SECRET is required in production/);
  });

  test('allows missing JWT_SECRET in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    const { loadConfig } = require('../config/index');
    expect(() => loadConfig()).not.toThrow();
  });

  test('loads when JWT_SECRET is set in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-test-secret';
    const { loadConfig } = require('../config/index');
    const cfg = loadConfig();
    expect(cfg.JWT_SECRET).toBe('prod-test-secret');
    expect(cfg.isProduction).toBe(true);
  });
});

describe('jwtSecret getJwtSecretForHmac', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('throws in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    const { getJwtSecretForHmac } = require('../utils/jwtSecret');
    expect(() => getJwtSecretForHmac()).toThrow(/JWT_SECRET is required in production/);
  });

  test('returns JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'hmac-test-secret';
    const { getJwtSecretForHmac } = require('../utils/jwtSecret');
    expect(getJwtSecretForHmac()).toBe('hmac-test-secret');
  });
});
