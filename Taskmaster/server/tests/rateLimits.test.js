const { isTrackingPath } = require('../app/rateLimits');

describe('rate limit route classification', () => {
  it('keeps public tracking endpoints under the tracking limiter', () => {
    expect(isTrackingPath('/open/pixel.gif')).toBe(true);
    expect(isTrackingPath('/click/abc')).toBe(true);
    expect(isTrackingPath('/unsubscribe')).toBe(true);
    expect(isTrackingPath('/webhooks/provider')).toBe(true);
  });

  it('does not classify retired CoreKnot API tracking routes as active tracking traffic', () => {
    expect(isTrackingPath('/api/track/open/pixel.gif')).toBe(false);
    expect(isTrackingPath('/api/track/click/abc')).toBe(false);
  });
});
