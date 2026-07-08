const { requestTimeoutMiddleware } = require('../middleware/requestTimeout');

describe('requestTimeoutMiddleware', () => {
  it('calls next and sets timeouts', () => {
    const req = { setTimeout: jest.fn() };
    const res = { setTimeout: jest.fn(), headersSent: false, status: jest.fn(), json: jest.fn() };
    const next = jest.fn();

    requestTimeoutMiddleware(5000)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.setTimeout).toHaveBeenCalledWith(5000);
    expect(res.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
  });
});
