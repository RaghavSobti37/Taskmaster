const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

const isRetryableTransactionError = (err) => {
  const labels = err?.errorLabels;
  if (Array.isArray(labels)) {
    if (labels.includes('TransientTransactionError') || labels.includes('UnknownTransactionCommitResult')) {
      return true;
    }
  }

  const code = err?.code ?? err?.codeName;
  if (code === 112 || code === 'WriteConflict') return true;

  const msg = String(err?.message || '');
  return /write conflict|TransientTransactionError|UnknownTransactionCommitResult/i.test(msg);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs fn inside session.withTransaction(), retrying transient write conflicts.
 * Callback must be idempotent — withTransaction may re-run it on retry.
 */
const withTransactionRetry = async (session, fn, { maxRetries = MAX_RETRIES } = {}) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      await session.withTransaction(fn);
      return;
    } catch (err) {
      lastError = err;
      if (!isRetryableTransactionError(err) || attempt >= maxRetries - 1) {
        throw err;
      }
      await sleep(BASE_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
};

module.exports = { withTransactionRetry, isRetryableTransactionError };
