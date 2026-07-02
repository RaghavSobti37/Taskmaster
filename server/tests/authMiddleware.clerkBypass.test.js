const jwt = require('jsonwebtoken');

jest.mock('../utils/clerkAuth', () => ({
  isClerkConfigured: jest.fn(() => true),
}));

const { protect } = require('../middleware/authMiddleware');

describe('authMiddleware cookie-only session', () => {
  const clerkJwt = jwt.sign(
    { sub: 'user_clerk123', sid: 'sess_abc' },
    'clerk_test_secret',
    { expiresIn: '1h' },
  );

  const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  test('rejects Clerk JWT in Authorization header without session cookie', async () => {
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${clerkJwt}` },
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized, no token' });
    expect(next).not.toHaveBeenCalled();
  });
});
