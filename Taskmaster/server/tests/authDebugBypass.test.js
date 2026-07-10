const { isDebugBypassEnabled } = require('../middleware/authMiddleware');

describe('isDebugBypassEnabled', () => {
  const envKeys = ['NODE_ENV', 'DEBUG_BYPASS'];

  const snapshot = () => Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

  let saved;

  beforeEach(() => {
    saved = snapshot();
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('returns false in production even when DEBUG_BYPASS=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEBUG_BYPASS = 'true';
    expect(isDebugBypassEnabled()).toBe(false);
  });

  it('returns true only in development with DEBUG_BYPASS=true', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEBUG_BYPASS = 'true';
    expect(isDebugBypassEnabled()).toBe(true);
  });

  it('returns false in development when DEBUG_BYPASS is unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEBUG_BYPASS;
    expect(isDebugBypassEnabled()).toBe(false);
  });
});
