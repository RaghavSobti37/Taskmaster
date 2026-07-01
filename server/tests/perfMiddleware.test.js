const perfMiddleware = require('../middleware/perfMiddleware');

describe('perfMiddleware', () => {
  const originalThreshold = process.env.SLOW_REQUEST_THRESHOLD_MS;

  afterEach(() => {
    if (originalThreshold === undefined) {
      delete process.env.SLOW_REQUEST_THRESHOLD_MS;
    } else {
      process.env.SLOW_REQUEST_THRESHOLD_MS = originalThreshold;
    }
    jest.resetModules();
  });

  it('defaults slow threshold to 5000ms', () => {
    delete process.env.SLOW_REQUEST_THRESHOLD_MS;
    jest.resetModules();
    const mod = require('../middleware/perfMiddleware');
    expect(mod.SLOW_THRESHOLD_MS).toBe(5000);
  });

  it('respects SLOW_REQUEST_THRESHOLD_MS env override', () => {
    process.env.SLOW_REQUEST_THRESHOLD_MS = '3500';
    jest.resetModules();
    const mod = require('../middleware/perfMiddleware');
    expect(mod.SLOW_THRESHOLD_MS).toBe(3500);
  });

  it('exports middleware function', () => {
    expect(typeof perfMiddleware).toBe('function');
  });
});
