const DEFAULT_SUPABASE_TIMEOUT_MS = 3000;

class SupabaseTimeoutError extends Error {
  constructor(ms = DEFAULT_SUPABASE_TIMEOUT_MS) {
    super(`Supabase query timed out after ${ms}ms`);
    this.name = 'SupabaseTimeoutError';
    this.code = 'SUPABASE_TIMEOUT';
    this.timedOut = true;
  }
}

async function withSupabaseTimeout(fn, ms = DEFAULT_SUPABASE_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new SupabaseTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = {
  DEFAULT_SUPABASE_TIMEOUT_MS,
  SupabaseTimeoutError,
  withSupabaseTimeout,
};
