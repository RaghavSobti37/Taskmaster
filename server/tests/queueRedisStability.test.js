describe('queue Redis stability', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('ioredis');
    jest.dontMock('bullmq');
  });

  function mockRedis(status = 'wait') {
    jest.doMock('ioredis', () => {
      return jest.fn().mockImplementation(() => ({
        status,
        connect: jest.fn(async () => {
          throw new Error('ECONNREFUSED');
        }),
        disconnect: jest.fn(),
        on: jest.fn(),
      }));
    });
  }

  it('does not enqueue campaign email jobs when Redis connection is not ready', async () => {
    process.env.NODE_ENV = 'development';
    mockRedis('wait');

    const addBulk = jest.fn(async () => {
      throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
    });
    jest.doMock('bullmq', () => ({
      Queue: jest.fn().mockImplementation(() => ({ addBulk, on: jest.fn() })),
    }));

    const { enqueueCampaignEmailJobs, isCampaignEmailQueueAvailable } = require('../services/campaignEmailQueue');

    expect(isCampaignEmailQueueAvailable()).toBe(false);
    await expect(enqueueCampaignEmailJobs([{ campaignId: 'c1', recipientId: 'r1' }]))
      .resolves.toEqual({ queued: 0, via: 'unavailable' });
    expect(addBulk).not.toHaveBeenCalled();
  });

  it('skips campaign email worker when Redis connection is not ready', () => {
    process.env.NODE_ENV = 'development';
    mockRedis('wait');

    const Worker = jest.fn();
    jest.doMock('bullmq', () => ({
      Queue: jest.fn().mockImplementation(() => ({ addBulk: jest.fn(), on: jest.fn() })),
      Worker,
    }));

    jest.isolateModules(() => {
      require('../services/campaignEmailQueue');
      const { initCampaignEmailWorker } = require('../workers/campaignEmailWorker');
      expect(initCampaignEmailWorker()).toBeNull();
    });

    expect(Worker).not.toHaveBeenCalled();
  });
});
