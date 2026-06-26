import opossum from 'opossum';

/**
 * Circuit breaker for downstream API calls — degraded offline fallback.
 */
export function createApiCircuitBreaker(action, options = {}) {
  const breaker = new opossum(action, {
    timeout: options.timeout ?? 3000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 15000,
  });

  breaker.fallback(() => ({
    status: 'Degraded',
    message: 'System operates in offline operational parameters.',
    fallbackData: [],
  }));

  return breaker;
}
