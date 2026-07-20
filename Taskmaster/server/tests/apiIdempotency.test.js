const mockRedis = {
  status: 'ready',
  set: jest.fn(),
  del: jest.fn(),
};

jest.mock('../utils/wslRedis', () => ({
  createRedisClient: () => mockRedis,
}));

const { apiIdempotency } = require('../middleware/apiIdempotency');

function makeRes() {
  const handlers = {};
  return {
    statusCode: 200,
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    emitFinish() {
      handlers.finish?.();
    },
  };
}

describe('apiIdempotency', () => {
  it('skips GET requests', async () => {
    const req = { method: 'GET', path: '/tasks', headers: {} };
    const res = {};
    const next = jest.fn();
    await apiIdempotency(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('scopes keys by tenant, actor, route, and request body fingerprint', async () => {
    mockRedis.set.mockResolvedValue('OK');
    const req = {
      method: 'POST',
      path: '/public-api/leads',
      headers: {
        authorization: 'Bearer ck_live_tenant_a_secret',
        'x-idempotency-key': 'same-key',
      },
      tenantId: 'tenant-a',
      body: { email: 'artist@example.com' },
    };
    const res = makeRes();
    const next = jest.fn();

    await apiIdempotency(req, res, next);
    res.emitFinish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^idempotency:tenant-a:api-key:[a-f0-9]{24}:POST:\/public-api\/leads:/),
      'PROCESSING',
      'NX',
      'EX',
      3600,
    );
    expect(mockRedis.set).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^idempotency:tenant-a:api-key:[a-f0-9]{24}:POST:\/public-api\/leads:/),
      'COMPLETED',
      'EX',
      3600,
    );
  });
});
