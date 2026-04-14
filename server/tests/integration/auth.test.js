import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { requestTracking } from '../../middleware/debugMiddleware.js';
import { errorHandler, notFoundHandler, asyncHandler } from '../../middleware/errorHandler.js';

// Mock auth controller
const mockAuthController = {
  login: (credentials) => {
    // Simulate login
    if (credentials.login === 'test@example.com' && credentials.password === 'password123') {
      return {
        success: true,
        token: jwt.sign({ id: 'user-123', email: credentials.login }, 'test-secret'),
        user: { id: 'user-123', email: credentials.login }
      };
    }
    throw { status: 401, message: 'Invalid credentials' };
  },

  register: (data) => {
    // Simulate registration
    if (data.email === 'existing@example.com') {
      throw { status: 409, message: 'Email already exists' };
    }
    if (!data.email.includes('@')) {
      throw { status: 400, message: 'Invalid email' };
    }
    return {
      success: true,
      token: jwt.sign({ id: 'new-user', email: data.email }, 'test-secret'),
      user: { id: 'new-user', email: data.email }
    };
  }
};

// Create test app
const createTestAuthApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestTracking);

  // Auth routes
  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const result = mockAuthController.login(req.body);
    res.json(result);
  }));

  app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const result = mockAuthController.register(req.body);
    res.status(201).json(result);
  }));

  app.get('/api/auth/me', asyncHandler(async (req, res) => {
    const authHeader = req.get('authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, 'test-secret');
      res.json({ user: decoded });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

describe('Authentication Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestAuthApp();
  });

  describe('Login', () => {
    test('Valid login should return token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    test('Invalid credentials should return 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Register', () => {
    test('Valid registration should create user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    test('Existing email should return 409', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user',
          email: 'existing@example.com',
          password: 'password123'
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Protected Routes', () => {
    test('GET /me without token should return 401', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('GET /me with valid token should return user', async () => {
      // Get token from login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: 'password123'
        });

      const token = loginRes.body.token;

      // Use token
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
    });

    test('GET /me with invalid token should return 401', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('GET /me with malformed Authorization header should return 401', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Request Handling', () => {
    test('Extra fields should be ignored', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test@example.com',
          password: 'password123',
          extraField: 'should be ignored',
          anotherField: 123
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
    });
  });
});
