const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

jest.mock('../utils/sendSystemEmail', () => ({
  sendSystemEmail: jest.fn().mockResolvedValue(undefined),
}));

const { sendSystemEmail } = require('../utils/sendSystemEmail');

describe('POST /api/auth/access-request', () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(async () => {
    await User.deleteMany();
    sendSystemEmail.mockClear();
    process.env.ADMIN_EMAIL = 'admin@example.com';
  });

  afterAll(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it('sends admin email for new access request', async () => {
    const res = await request(app).post('/api/auth/access-request').send({
      email: 'newhire@example.com',
      name: 'New Hire',
      message: 'Sales team',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/admin/i);
    expect(sendSystemEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('newhire@example.com'),
      }),
    );
  });

  it('rejects when account already exists', async () => {
    await User.create({
      name: 'Existing',
      email: 'exists@example.com',
      password: 'TempPass9!',
    });

    const res = await request(app).post('/api/auth/access-request').send({
      email: 'exists@example.com',
    });

    expect(res.statusCode).toBe(409);
    expect(sendSystemEmail).not.toHaveBeenCalled();
  });
});
