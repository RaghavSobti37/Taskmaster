const request = require('supertest');
const app = require('../server');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

describe('Task/Project PATCH CRUD (BUG-A2/A3)', () => {
  it('PATCH /api/projects/:id updates after POST create', async () => {
    const agent = request.agent(app);
    const email = `patch-project-${Date.now()}@test.coreknot.local`;
    await agent.post('/api/auth/register').send({
      name: 'PATCH Project User',
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });

    const ts = Date.now();
    const createProject = await agent.post('/api/projects').send({
      name: `E2E Patch Project ${ts}`,
      status: 'active',
    });
    expect(createProject.status).toBe(201);
    const projectId = createProject.body._id || createProject.body.id;

    const patchProject = await agent
      .patch(`/api/projects/${projectId}`)
      .send({ description: 'Updated by patch test' });
    expect(patchProject.status).toBe(200);
    expect(patchProject.body.description).toBe('Updated by patch test');
  });

  it('registers PATCH on /api/tasks/:id', () => {
    const taskRoutes = require('../domains/tasks/routes');
    const hasPatch = taskRoutes.stack.some(
      (layer) => layer.route?.path === '/:id' && layer.route?.methods?.patch
    );
    expect(hasPatch).toBe(true);
  });
});
