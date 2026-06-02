const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const TEST_PASSWORD = DEV_DEFAULT_PASSWORD;

describe('Authentication API', () => {
  beforeEach(async () => {
    await User.deleteMany();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: TEST_PASSWORD,
          gender: 'male',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('coreknot_token=')])
      );
      expect(res.body).not.toHaveProperty('token');
      expect(res.body.email).toEqual('test@example.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should prevent NoSQL injection via object payloads', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: { $ne: 'test' },
          email: { $ne: 'test@example.com' },
          password: { $gt: '' },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Invalid input format');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: TEST_PASSWORD,
          gender: 'male',
        });
    });

    it('should login an existing user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: TEST_PASSWORD,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('coreknot_token=')])
      );
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject invalid credentials format (NoSQL injection prevention)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $ne: 'test@example.com' },
          password: { $gt: '' },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Invalid credentials format');
    });
  });
});
