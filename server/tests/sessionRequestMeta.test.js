const {
  resolveClientIp,
  formatSessionIp,
  isLoopbackIp,
  pickSessionIp,
} = require('../utils/sessionRequestMeta');

describe('sessionRequestMeta', () => {
  const reqWithHeaders = (headers = {}, ip = '') => ({
    headers,
    ip,
    socket: { remoteAddress: ip },
  });

  it('prefers x-forwarded-for over socket address', () => {
    const ip = resolveClientIp(reqWithHeaders({ 'x-forwarded-for': '203.0.113.44, 10.0.0.1' }, '::1'));
    expect(ip).toBe('203.0.113.44');
  });

  it('normalizes IPv4-mapped IPv6', () => {
    const ip = resolveClientIp(reqWithHeaders({}, '::ffff:192.168.1.8'));
    expect(ip).toBe('192.168.1.8');
  });

  it('hides loopback from session display', () => {
    expect(formatSessionIp('::1')).toBeNull();
    expect(formatSessionIp('127.0.0.1')).toBeNull();
    expect(formatSessionIp('203.0.113.44')).toBe('203.0.113.44');
  });

  it('upgrades stored loopback when fresh IP is public', () => {
    expect(pickSessionIp('::1', '203.0.113.44')).toBe('203.0.113.44');
    expect(pickSessionIp('203.0.113.44', '::1')).toBe('203.0.113.44');
  });

  it('detects loopback variants', () => {
    expect(isLoopbackIp('::1')).toBe(true);
    expect(isLoopbackIp('127.0.0.1')).toBe(true);
    expect(isLoopbackIp('203.0.113.1')).toBe(false);
  });
});
