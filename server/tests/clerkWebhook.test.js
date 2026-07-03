const {
  handleUserCreated,
  handleUserDeleted,
} = require('../domains/auth/webhooks/clerkWebhookHandler');
const User = require('../models/User');

describe('clerkWebhookHandler', () => {
  beforeEach(async () => {
    await User.deleteMany();
  });

  it('handleUserCreated links Clerk user to pre-provisioned CoreKnot account', async () => {
    await User.create({
      name: 'Provisioned User',
      email: 'new@example.com',
      password: 'TempPass9!',
      mustChangePassword: true,
    });

    const result = await handleUserCreated({
      data: {
        id: 'user_clerk_1',
        email_addresses: [{ id: 'em_1', email_address: 'new@example.com' }],
        primary_email_address_id: 'em_1',
        first_name: 'New',
        last_name: 'User',
      },
    });
    expect(result.action).toBe('linked');
    const user = await User.findOne({ email: 'new@example.com' });
    expect(user.clerkId).toBe('user_clerk_1');
  });

  it('handleUserCreated skips when CoreKnot user was not provisioned', async () => {
    const result = await handleUserCreated({
      data: {
        id: 'user_clerk_2',
        email_addresses: [{ id: 'em_2', email_address: 'stranger@example.com' }],
        primary_email_address_id: 'em_2',
      },
    });
    expect(result.action).toBe('skipped');
    expect(result.reason).toBe('coreknot_user_not_provisioned');
    expect(await User.findOne({ email: 'stranger@example.com' })).toBeNull();
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
