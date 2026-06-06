const jwt = require('jsonwebtoken');
const {
  COOKIE_NAME,
  LEGACY_COOKIE_NAMES,
  getCookieOptions,
  isFirstPartyProxiedRequest,
} = require('../utils/authCookie');
// isFirstPartyProxiedRequest used in mobile proxy detection tests below
const {
  generateSessionToken,
  verifySessionToken,
  isAbsoluteSessionExpired,
  shouldRefreshSession,
  resolveLoginAt,
} = require('../utils/authSession');

describe('authCookie session reset', () => {
  it('uses v3 cookie and purges v1/v2 legacy names', () => {
    expect(COOKIE_NAME).toBe('coreknot_token_v3');
    expect(LEGACY_COOKIE_NAMES).toEqual(expect.arrayContaining(['coreknot_token_v2', 'coreknot_token']));
  });

  it('detects Vercel rewrite proxy via X-Forwarded-Host', () => {
    const req = { get: (h) => (h === 'x-forwarded-host' ? 'tsccoreknot.com' : undefined) };
    expect(isFirstPartyProxiedRequest(req)).toBe(true);
  });

  it('uses Lax session cookies for proxied mobile logins', () => {
    process.env.NODE_ENV = 'production';
    const req = { get: (h) => (h === 'x-forwarded-host' ? 'tsccoreknot.com' : undefined) };
    const opts = getCookieOptions(req);
    expect(opts.sameSite).toBe('lax');
    expect(opts.partitioned).toBeUndefined();
  });

  it('treats www host as first-party when bare domain is allowlisted', () => {
    process.env.NODE_ENV = 'production';
    const req = { get: (h) => (h === 'x-forwarded-host' ? 'www.tsccoreknot.com' : undefined) };
    expect(isFirstPartyProxiedRequest(req)).toBe(true);
    expect(getCookieOptions(req).sameSite).toBe('lax');
  });

  it('detects first-party via Origin when X-Forwarded-Host missing (Render proxy)', () => {
    process.env.NODE_ENV = 'production';
    const req = {
      get: (h) => {
        if (h === 'host') return 'taskmaster-jfw0.onrender.com';
        if (h === 'origin') return 'https://tsccoreknot.com';
        return undefined;
      },
    };
    expect(isFirstPartyProxiedRequest(req)).toBe(true);
    expect(getCookieOptions(req).sameSite).toBe('lax');
  });
});

describe('authSession sliding sessions', () => {
  const secret = 'test-session-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.JWT_ABSOLUTE_MAX_DAYS = '30';
    process.env.JWT_REFRESH_MINUTES = '60';
  });

  it('includes loginAt on fresh tokens', () => {
    const token = generateSessionToken('user123');
    const decoded = verifySessionToken(token);
    expect(decoded.id).toBe('user123');
    expect(decoded.loginAt).toBeDefined();
    expect(decoded.loginAt).toBe(decoded.iat);
    expect(decoded.jti).toBeDefined();
  });

  it('preserves loginAt across sliding refresh tokens', () => {
    const loginAt = Math.floor(Date.now() / 1000) - 3600;
    const token = generateSessionToken('user123', loginAt);
    const decoded = verifySessionToken(token);
    expect(resolveLoginAt(decoded)).toBe(loginAt);
  });

  it('flags absolute session expiry after 30 days', () => {
    const loginAt = Math.floor((Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000);
    const token = jwt.sign(
      { id: 'user123', loginAt },
      secret,
      { expiresIn: '7d' },
    );
    const decoded = verifySessionToken(token);
    expect(isAbsoluteSessionExpired(decoded)).toBe(true);
  });

  it('does not refresh until refresh interval elapsed', () => {
    const token = generateSessionToken('user123');
    const decoded = verifySessionToken(token);
    expect(shouldRefreshSession(decoded)).toBe(false);
  });

  it('refreshes when token age exceeds refresh interval', () => {
    const loginAt = Math.floor(Date.now() / 1000) - 7200;
    const token = jwt.sign(
      { id: 'user123', loginAt },
      secret,
      { expiresIn: '7d', noTimestamp: true },
    );
    const decoded = jwt.verify(token, secret);
    decoded.iat = loginAt;
    expect(shouldRefreshSession(decoded)).toBe(true);
  });
});
