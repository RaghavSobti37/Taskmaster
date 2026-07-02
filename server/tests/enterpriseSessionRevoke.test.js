const { revokeAllUserSessions, _resetForTests } = require('../utils/sessionRegistry');

describe('sessionRegistry.revokeAllUserSessions', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('revokes all sessions for a user', async () => {
    const userId = 'user-123';
    const { registerSession } = require('../utils/sessionRegistry');
    await registerSession(
      { headers: { 'user-agent': 'test' }, ip: '127.0.0.1' },
      userId,
      { jti: 'jti-a', exp: Math.floor(Date.now() / 1000) + 3600 },
    );
    await registerSession(
      { headers: { 'user-agent': 'test2' }, ip: '127.0.0.1' },
      userId,
      { jti: 'jti-b', exp: Math.floor(Date.now() / 1000) + 3600 },
    );

    const { listUserSessions } = require('../utils/sessionRegistry');
    expect((await listUserSessions(userId)).length).toBe(2);

    const { revoked } = await revokeAllUserSessions(userId);
    expect(revoked).toBe(2);
    expect((await listUserSessions(userId)).length).toBe(0);
  });
});
