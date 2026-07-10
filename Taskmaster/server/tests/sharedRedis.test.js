jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const client = {
      status: 'wait',
      connect: jest.fn(async () => {
        client.status = 'ready';
      }),
      ping: jest.fn().mockResolvedValue('PONG'),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
    };
    return client;
  });
});

describe('sharedRedis', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('connects lazy client before ping', async () => {
    const { pingSharedRedis, getSharedRedis } = require('../utils/sharedRedis');

    await expect(pingSharedRedis()).resolves.toBe('PONG');

    const instance = getSharedRedis();
    expect(instance.connect).toHaveBeenCalledTimes(1);
    expect(instance.ping).toHaveBeenCalledTimes(1);
  });
});
