const { RedisRateLimitStore } = require('./redisRateLimitStore');

describe('RedisRateLimitStore', () => {
  it('increments in memory when redis unavailable', async () => {
    const store = new RedisRateLimitStore({ prefix: 't:', windowMs: 60_000 });
    store.init({ windowMs: 60_000 });

    const first = await store.increment('user-1');
    const second = await store.increment('user-1');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
  });
});
