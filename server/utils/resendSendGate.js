const logger = require('./logger');

const WINDOW_MS = 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const maxPerSecond = () =>
  Math.max(1, parseInt(process.env.RESEND_RATE_LIMIT || process.env.CAMPAIGN_EMAIL_RATE_LIMIT || '2', 10));

/** True when Resend (or compatible API) rejected the call for throughput. */
const isResendRateLimitError = (err) => {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.statusCode || err?.status || err?.response?.status;
  return status === 429
    || msg.includes('too many requests')
    || msg.includes('rate limit')
    || msg.includes('rate_limit');
};

/**
 * Global Redis token bucket — one gate for all API/worker instances sharing REDIS_URL.
 * Falls back to fixed delay when Redis unavailable (in-process memory queue).
 */
const acquireResendSendSlot = async (redis) => {
  const limit = maxPerSecond();
  const minSpacingMs = Math.ceil(WINDOW_MS / limit);

  if (!redis || redis.status !== 'ready') {
    await sleep(minSpacingMs);
    return;
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const windowKey = `resend:send:window:${Math.floor(Date.now() / WINDOW_MS)}`;
    try {
      const count = await redis.incr(windowKey);
      if (count === 1) {
        await redis.pexpire(windowKey, WINDOW_MS + 200);
      }
      if (count <= limit) return;
      await redis.decr(windowKey);
    } catch (err) {
      logger.warn('resendSendGate', 'Redis gate failed — using spacing fallback', { error: err.message });
      await sleep(minSpacingMs);
      return;
    }
    await sleep(50);
  }

  throw new Error('Resend send gate timeout — could not acquire slot within 120s');
};

module.exports = {
  isResendRateLimitError,
  acquireResendSendSlot,
  maxPerSecond,
};
