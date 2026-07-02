const {
  handleUserCreated,
  handleUserDeleted,
} = require('../domains/auth/webhooks/clerkWebhookHandler');
const User = require('../models/User');

describe('clerkWebhookHandler', () => {
  beforeEach(async () => {
    await User.deleteMany();
  });

  it('handleUserCreated links new Clerk user', async () => {
    const result = await handleUserCreated({
      data: {
        id: 'user_clerk_1',
        email_addresses: [{ id: 'em_1', email_address: 'new@example.com' }],
        primary_email_address_id: 'em_1',
        first_name: 'New',
        last_name: 'User',
      },
    });
    expect(result.action).toBe('created');
    const user = await User.findOne({ email: 'new@example.com' });
    expect(user.clerkId).toBe('user_clerk_1');
  });

  it('handleUserDeleted suspends and revokes sessions', async () => {
    const user = await User.create({
      name: 'Del User',
      email: 'del@example.com',
      clerkId: 'user_clerk_del',
      password: 'x'.repeat(32),
    });
    const { registerSession } = require('../utils/sessionRegistry');
    await registerSession(
      { headers: {}, ip: '127.0.0.1' },
      user._id.toString(),
      { jti: 'jti-del', exp: Math.floor(Date.now() / 1000) + 3600 },
    );

    const result = await handleUserDeleted({ data: { id: 'user_clerk_del' } });
    expect(result.action).toBe('suspended');

    const updated = await User.findById(user._id);
    expect(updated.suspended).toBe(true);

    const { listUserSessions } = require('../utils/sessionRegistry');
    expect((await listUserSessions(user._id.toString())).length).toBe(0);
  });
});
