const { requestTimeoutMiddleware, LONG_TIMEOUT_RE } = require('../middleware/requestTimeout');
const { sendJson } = require('../utils/httpRespond');

describe('requestTimeoutMiddleware', () => {
  it('calls next and sets timeouts', () => {
    const req = { setTimeout: jest.fn(), originalUrl: '/api/health' };
    const res = { setTimeout: jest.fn(), headersSent: false, status: jest.fn(), json: jest.fn() };
    const next = jest.fn();

    requestTimeoutMiddleware(5000, 12000)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.setTimeout).toHaveBeenCalledWith(5000);
    expect(res.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
  });

  it('uses long timeout for heavy CoreKnot-owned routes', () => {
    const req = { setTimeout: jest.fn(), originalUrl: '/api/reports/export?foo=1' };
    const res = { setTimeout: jest.fn(), headersSent: false };
    const next = jest.fn();

    requestTimeoutMiddleware(30_000, 120_000)(req, res, next);

    expect(req.setTimeout).toHaveBeenCalledWith(120_000);
    expect(res.setTimeout).toHaveBeenCalledWith(120_000, expect.any(Function));
  });

  it('marks timedOut and skips double json when headers already sent', () => {
    const req = { setTimeout: jest.fn(), originalUrl: '/api/reports/export' };
    let timeoutCb;
    const res = {
      headersSent: false,
      writableEnded: false,
      status: jest.fn(function status() { return this; }),
      json: jest.fn(),
      setTimeout: jest.fn((_ms, cb) => { timeoutCb = cb; }),
    };
    requestTimeoutMiddleware(100, 100)(req, res, () => {});
    timeoutCb();
    expect(req.timedOut).toBe(true);
    expect(res.status).toHaveBeenCalledWith(503);

    res.headersSent = true;
    res.status.mockClear();
    timeoutCb();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('LONG_TIMEOUT_RE excludes retired email routes', () => {
    expect(LONG_TIMEOUT_RE.test('/api/mail/audience/data-hub')).toBe(false);
    expect(LONG_TIMEOUT_RE.test('/api/campaigns')).toBe(false);
    expect(LONG_TIMEOUT_RE.test('/api/newsletter/issues/current')).toBe(false);
    expect(LONG_TIMEOUT_RE.test('/api/reports/export')).toBe(true);
    expect(LONG_TIMEOUT_RE.test('/api/health')).toBe(false);
  });
});

describe('sendJson', () => {
  it('no-ops when headers already sent', () => {
    const res = {
      headersSent: true,
      status: jest.fn(function status() { return this; }),
      json: jest.fn(),
    };
    expect(sendJson(res, 201, { ok: true })).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sends when open', () => {
    const res = {
      headersSent: false,
      status: jest.fn(function status() { return this; }),
      json: jest.fn(),
    };
    expect(sendJson(res, 201, { ok: true })).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
