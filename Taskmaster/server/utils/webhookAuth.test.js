const {
  computeWebhookSignature,
  verifyWebhookSignature,
  rejectUnlessBookCallAuthorized,
  verifyBookCallWebhookSecret,
} = require('./webhookAuth');

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
};

describe('webhookAuth book-call', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.BOOK_CALL_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects unsigned book-call payload when secret is not configured', () => {
    const req = { headers: {}, rawBody: Buffer.from('{}') };
    const res = mockRes();

    expect(rejectUnlessBookCallAuthorized(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ success: false });
  });

  it('rejects unsigned book-call payload when secret is configured', () => {
    process.env.BOOK_CALL_WEBHOOK_SECRET = 'test-secret';
    const req = { headers: {}, rawBody: Buffer.from('{"name":"QA"}') };
    const res = mockRes();

    expect(rejectUnlessBookCallAuthorized(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts book-call payload with matching X-Webhook-Secret', () => {
    process.env.BOOK_CALL_WEBHOOK_SECRET = 'test-secret';
    const req = { headers: { 'x-webhook-secret': 'test-secret' }, rawBody: Buffer.from('{}') };
    const res = mockRes();

    expect(rejectUnlessBookCallAuthorized(req, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
    expect(verifyBookCallWebhookSecret(req)).toBe(true);
  });

  it('accepts book-call payload with valid HMAC signature', () => {
    process.env.BOOK_CALL_WEBHOOK_SECRET = 'test-secret';
    const rawBody = Buffer.from('{"name":"QA"}');
    const signature = computeWebhookSignature(rawBody, 'test-secret');
    const req = { headers: { 'x-webhook-signature': signature }, rawBody };
    const res = mockRes();

    expect(rejectUnlessBookCallAuthorized(req, res)).toBe(true);
    expect(verifyWebhookSignature(req, 'BOOK_CALL_WEBHOOK_SECRET')).toEqual({ ok: true });
  });
});
