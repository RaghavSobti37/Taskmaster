const request = require('supertest');
const app = require('../server');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const TEST_PASSWORD = DEV_DEFAULT_PASSWORD;

const registerAgent = async (agent, email = 'integration@test.com') => {
  await agent
    .post('/api/auth/register')
    .send({
      name: 'Integration User',
      email,
      password: TEST_PASSWORD,
      gender: 'male',
    });
  return agent;
};

describe('Health API', () => {
  it('GET /api/health returns ok or starting', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('dependencies');
  });

  it('GET /api/health returns HTML dashboard for browser Accept', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Accept', 'text/html,application/xhtml+xml');
    expect([200, 503]).toContain(res.statusCode);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('CoreKnot');
    expect(res.text).toContain('SYSTEM HEALTH');
    expect(res.text).toContain('Raw JSON');
    expect(res.text).toContain('Heap Memory Breakdown');
    expect(res.text).toContain('heapUsed');
    expect(res.text).toContain('/api/health/dashboard.js');
    expect(res.text).toContain('/api/health/brand-mark.svg');
  });

  it('GET /api/health/dashboard.js is served for CSP-safe client', async () => {
    const res = await request(app).get('/api/health/dashboard.js');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.text).toContain('switchTab');
  });

  it('GET /api/health?format=json forces JSON', async () => {
    const res = await request(app)
      .get('/api/health?format=json')
      .set('Accept', 'text/html');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('dependencies');
  });

  it('GET /api/health?dashboard=1 returns live dashboard payload', async () => {
    const res = await request(app).get('/api/health?dashboard=1');
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body.dashboard).toBeDefined();
    expect(res.body.dashboard).toHaveProperty('score');
    expect(res.body.dashboard.runtime.heap.segments.length).toBeGreaterThan(0);
    expect(res.body.dashboard.metrics).toHaveProperty('requestsPerMin');
  });
});

describe('Tasks API integration', () => {
  it('lists tasks when authenticated', async () => {
    const agent = request.agent(app);
    await registerAgent(agent, 'tasks-integration@test.com');

    const listRes = await agent.get('/api/tasks');
    expect(listRes.statusCode).toBe(200);
    const tasks = Array.isArray(listRes.body) ? listRes.body : listRes.body.data || listRes.body.tasks || [];
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('rejects unauthenticated task list', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth sessions API integration', () => {
  it('lists active sessions when authenticated', async () => {
    const agent = request.agent(app);
    await registerAgent(agent, 'sessions-integration@test.com');

    const res = await agent.get('/api/auth/sessions');
    expect(res.statusCode).toBe(200);
    expect(res.body.sessions).toBeDefined();
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThan(0);
  });
});
