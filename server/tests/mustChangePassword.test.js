const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const { generateSecurePassword } = require('../utils/passwordValidation');

const NEW_PASSWORD = 'SecurePass9!';

describe('mustChangePassword flow', () => {
  const agent = request.agent(app);

  beforeEach(async () => {
    await User.deleteMany();
    const temporaryPassword = generateSecurePassword();

    await User.create({
      name: 'Temp User',
      email: 'temp@example.com',
      password: temporaryPassword,
      mustChangePassword: true,
    });

    const loginRes = await agent.post('/api/auth/login').send({
      email: 'temp@example.com',
      password: temporaryPassword,
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.mustChangePassword).toBe(true);
  });

  it('clears mustChangePassword via change-required-password', async () => {
    const res = await agent.post('/api/auth/change-required-password').send({
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.mustChangePassword).toBe(false);
    expect(res.body.profileCompletion?.needsPasswordChange).toBe(false);

    const me = await agent.get('/api/auth/me');
    expect(me.statusCode).toBe(200);
    expect(me.body.mustChangePassword).toBe(false);
  });

  it('clears mustChangePassword via profile update without current password', async () => {
    const res = await agent.put('/api/users/profile').send({
      newPassword: NEW_PASSWORD,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.mustChangePassword).toBe(false);
    expect(res.body.profileCompletion?.needsPasswordChange).toBe(false);

    const me = await agent.get('/api/auth/me');
    expect(me.statusCode).toBe(200);
    expect(me.body.mustChangePassword).toBe(false);
  });
});
