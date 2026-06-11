import Redis from 'ioredis';

/** Quick Redis probe — used before BullMQ workers start. */
export async function probeRedisUrl(
  url: string,
  timeoutMs = 2000,
): Promise<boolean> {
  if (!url?.trim()) return false;

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: timeoutMs,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  client.on('error', () => {});

  try {
    await client.connect();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}
