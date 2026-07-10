const jwt = require('jsonwebtoken');
const {
  revokeToken,
  isTokenRevoked,
  newJti,
  _resetForTests,
} = require('../utils/tokenRevocation');

describe('tokenRevocation', () => {
  beforeEach(() => {
    _resetForTests();
    process.env.JWT_SECRET = 'revoke-test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
  });

  it('issues unique jti values', () => {
    const a = newJti();
    const b = newJti();
    expect(a).not.toBe(b);
  });

  it('revokes a token jti in memory fallback', async () => {
    const jti = newJti();
    const decoded = jwt.decode(
      jwt.sign({ id: 'u1', jti }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    );
    await revokeToken(decoded);
    expect(await isTokenRevoked(decoded)).toBe(true);
  });

  it('ignores tokens without jti', async () => {
    const decoded = { id: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 };
    expect(await isTokenRevoked(decoded)).toBe(false);
  });
});
