const jwt = require('jsonwebtoken');
const {
  registerSession,
  ensureSession,
  listUserSessions,
  removeSession,
  rotateSession,
  _resetForTests,
} = require('../utils/sessionRegistry');

describe('sessionRegistry', () => {
  beforeEach(() => {
    _resetForTests();
    process.env.JWT_SECRET = 'session-registry-test';
  });

  const fakeReq = (ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0') => ({
    headers: { 'user-agent': ua },
    ip: '127.0.0.1',
  });

  it('registers and lists sessions with current marker', async () => {
    const jti = 'sess-a';
    const decoded = jwt.decode(
      jwt.sign({ id: 'user1', jti, loginAt: Math.floor(Date.now() / 1000) }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    );
    await registerSession(fakeReq(), 'user1', decoded);
    const sessions = await listUserSessions('user1', jti);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].jti).toBe(jti);
    expect(sessions[0].current).toBe(true);
    expect(sessions[0].label).toContain('Chrome');
  });

  it('rotates jti while preserving createdAt', async () => {
    const oldJti = 'sess-old';
    const oldDecoded = jwt.decode(
      jwt.sign({ id: 'user2', jti: oldJti }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    );
    await registerSession(fakeReq(), 'user2', oldDecoded);
    const newJti = 'sess-new';
    const newDecoded = jwt.decode(
      jwt.sign({ id: 'user2', jti: newJti }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    );
    await rotateSession(fakeReq(), 'user2', oldJti, newDecoded);
    const sessions = await listUserSessions('user2', newJti);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].jti).toBe(newJti);
    expect(sessions[0].current).toBe(true);
  });

  it('ensureSession backfills missing registry rows', async () => {
    const jti = 'sess-ensure';
    const decoded = jwt.decode(
      jwt.sign({ id: 'user4', jti }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    );
    const created = await ensureSession(fakeReq(), 'user4', decoded);
    expect(created).toBe(true);
    const again = await ensureSession(fakeReq(), 'user4', decoded);
    expect(again).toBe(false);
    const sessions = await listUserSessions('user4', jti);
    expect(sessions).toHaveLength(1);
  });

  it('removes a session', async () => {
    const jti = 'sess-remove';
    const decoded = jwt.decode(
      jwt.sign({ id: 'user3', jti }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    );
    await registerSession(fakeReq(), 'user3', decoded);
    await removeSession('user3', jti);
    const sessions = await listUserSessions('user3');
    expect(sessions).toHaveLength(0);
  });
});
