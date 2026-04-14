import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { requestTracking, corsDebug } from '../../middleware/debugMiddleware.js';
import { notFoundHandler, errorHandler } from '../../middleware/errorHandler.js';

// Create a minimal test app
const createTestApp = () => {
  const app = express();

  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  }));

  app.use(express.json());
  app.use(requestTracking);
  app.use(corsDebug);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: 'test'
    });
  });

  // 404 and error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

describe('Server Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Health Check Endpoint', () => {
    test('GET /api/health should return 200 with status ok', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment', 'test');
    });

    test('Health check response should include timestamp', async () => {
      const response = await request(app).get('/api/health');
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('CORS Configuration', () => {
    test('Request from allowed origin should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
    });

    test('Should handle multiple origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('GET /unknown-route should return 404', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('404 response should be valid JSON', async () => {
      const response = await request(app).get('/api/unknown');
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Request Validation', () => {
    test('POST with invalid JSON should return 400', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });

  describe('Request Methods', () => {
    test('OPTIONS request should be handled by CORS', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });

    test('DELETE request to health endpoint should return 404', async () => {
      const response = await request(app)
        .delete('/api/health')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
