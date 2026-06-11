#!/usr/bin/env node
/**
 * Member explorer API sweep — no browser required.
 * Usage: node e2e/scripts/member-explore-api.cjs
 */
const request = require('supertest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL || 'e2e-dept-editor@test.coreknot.local';
const PASSWORD = '1Million#';
const SANDBOX_ID = '6a2925ff19424604c33b579d';

const results = { pages: [], bugs: [], checks: [] };

function pass(name, detail) {
  results.checks.push({ name, ok: true, detail });
}
function fail(name, detail) {
  results.bugs.push({ name, detail });
  results.checks.push({ name, ok: false, detail });
}

(async () => {
  const app = require('../../server/server');
  const User = require('../../server/models/User');
  const Task = require('../../server/domains/tasks/models/Task');
  const TaskAssignment = require('../../server/domains/tasks/models/TaskAssignment');
  const BYPASS = { bypassTenant: true };

  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: MEMBER_EMAIL, password: PASSWORD });
  if (login.statusCode !== 200) {
    console.error('LOGIN_FAIL', login.statusCode, login.body);
    process.exit(1);
  }
  pass('login', `${MEMBER_EMAIL} → 200`);

  const member = await User.findOne({ email: MEMBER_EMAIL }).setOptions(BYPASS);

  // Seed assignee task on sandbox
  let task = await Task.findOne({ projectId: SANDBOX_ID, title: '[E2E] Member task' }).setOptions(BYPASS);
  if (!task && member) {
    task = await Task.create({
      title: '[E2E] Member task',
      projectId: SANDBOX_ID,
      status: 'todo',
      createdBy: member._id,
      workspace: 'GENERAL',
    });
    await TaskAssignment.create({ taskId: task._id, userId: member._id, role: 'assignee' });
    pass('seed_task', String(task._id));
  }

  const allowed = [
    ['GET', '/api/projects', null, [200]],
    ['GET', `/api/tasks?projectId=${SANDBOX_ID}`, null, [200]],
    ['GET', '/api/attendance?start=2026-06-10&end=2026-06-10&mine=true', null, [200]],
    ['GET', '/api/notes', null, [200]],
    ['GET', '/api/calendar?start=2026-06-01&end=2026-06-30', null, [200]],
    ['POST', '/api/notes', { title: 'E2E member note', content: 'probe', workspace: 'GENERAL' }, [200, 201]],
    ['POST', '/api/attendance/check-in', { note: 'E2E probe' }, [200, 201, 400]],
  ];

  for (const [method, url, body, expectStatus] of allowed) {
    const req = agent[method.toLowerCase()](url);
    const res = body ? await req.send(body) : await req;
    const ok = expectStatus.includes(res.statusCode);
    const label = `${method} ${url.split('?')[0]}`;
    results.pages.push(label);
    if (ok) pass(label, `HTTP ${res.statusCode}`);
    else fail(label, `Expected ${expectStatus.join('|')}, got ${res.statusCode}: ${res.body?.error || JSON.stringify(res.body).slice(0, 120)}`);
  }

  const forbidden = [
    ['PUT', `/api/projects/${SANDBOX_ID}`, { name: 'Hacked by member' }, [403]],
    ['GET', '/api/admin/users', null, [403, 404]],
    ['DELETE', '/api/admin/users/6a2925f7b7e86470c1e91699', null, [403, 404]],
    ['POST', '/api/admin/scripts/run', { script: 'noop' }, [403, 404]],
    ['GET', '/api/data-hub/backups', null, [403, 404]],
  ];

  for (const [method, url, body, expectStatus] of forbidden) {
    const req = agent[method.toLowerCase()](url);
    const res = body ? await req.send(body) : await req;
    const ok = expectStatus.includes(res.statusCode);
    const label = `FORBIDDEN ${method} ${url}`;
    if (ok) pass(label, `HTTP ${res.statusCode}`);
    else fail(label, `Expected ${expectStatus.join('|')}, got ${res.statusCode}`);
  }

  // Verify task visible in list
  const tasks = await agent.get(`/api/tasks?projectId=${SANDBOX_ID}`);
  const hasE2eTask = (tasks.body?.tasks || tasks.body || []).some?.((t) => t.title?.includes('[E2E] Member task'))
    || JSON.stringify(tasks.body).includes('[E2E] Member task');
  if (hasE2eTask) pass('assigned_task_visible', 'Member sees sandbox task');
  else fail('assigned_task_visible', `Task list missing seeded task (${tasks.statusCode})`);

  console.log(JSON.stringify(results, null, 2));
  process.exit(results.bugs.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
