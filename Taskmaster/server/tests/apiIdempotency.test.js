const { apiIdempotency } = require('../middleware/apiIdempotency');

describe('apiIdempotency', () => {
  it('skips GET requests', async () => {
    const req = { method: 'GET', path: '/tasks', headers: {} };
    const res = {};
    const next = jest.fn();
    await apiIdempotency(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
