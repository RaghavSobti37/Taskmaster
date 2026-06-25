const { isResendRateLimitError, maxPerSecond } = require('../utils/resendSendGate');

describe('resendSendGate', () => {
  describe('isResendRateLimitError', () => {
    it('detects Resend throughput message', () => {
      expect(isResendRateLimitError(new Error('Too many requests. You can only make 2 requests per second.'))).toBe(true);
    });

    it('detects HTTP 429', () => {
      expect(isResendRateLimitError({ statusCode: 429, message: 'rate limited' })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isResendRateLimitError(new Error('Invalid API key'))).toBe(false);
    });
  });

  describe('maxPerSecond', () => {
    const original = process.env.RESEND_RATE_LIMIT;

    afterEach(() => {
      if (original === undefined) delete process.env.RESEND_RATE_LIMIT;
      else process.env.RESEND_RATE_LIMIT = original;
    });

    it('defaults to 2', () => {
      delete process.env.RESEND_RATE_LIMIT;
      delete process.env.CAMPAIGN_EMAIL_RATE_LIMIT;
      expect(maxPerSecond()).toBe(2);
    });
  });
});
