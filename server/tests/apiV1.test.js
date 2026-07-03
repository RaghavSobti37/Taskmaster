const request = require('supertest');
const app = require('../server');

describe('API v1', () => {
  it('GET /api/v1/health returns apiVersion', async () => {
    const res = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(res.statusCode);
    expect(res.headers['x-api-version']).toBe('v1');
    expect(res.body.apiVersion).toBe('v1');
  });
});
