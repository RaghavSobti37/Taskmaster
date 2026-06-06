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
