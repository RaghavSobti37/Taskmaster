#!/usr/bin/env node
/** HTTP member sweep against running API — no server boot. */
const http = require('http');

const API = 'http://127.0.0.1:5000';
const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL || 'e2e-dept-editor@test.coreknot.local';
const PASSWORD = '1Million#';
const SANDBOX_ID = '6a2925ff19424604c33b579d';

const results = { user: MEMBER_EMAIL, pages: [], bugs: [], checks: [] };
let cookie = '';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(path, API);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
      }
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch { /* text */ }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function pass(name, detail) { results.checks.push({ name, ok: true, detail }); }
function fail(name, detail) { results.bugs.push({ id: `BUG-MEM-${results.bugs.length + 1}`, name, detail }); results.checks.push({ name, ok: false, detail }); }

(async () => {
  const login = await req('POST', '/api/auth/login', { email: MEMBER_EMAIL, password: PASSWORD });
  if (login.status !== 200) {
    console.error('LOGIN_FAIL', login);
    process.exit(1);
  }
  pass('login', `200 ${login.body?.name}`);

  const probes = [
    ['GET', '/api/projects', null, [200], 'projects'],
    ['GET', `/api/tasks?projectId=${SANDBOX_ID}`, null, [200], 'project_tasks'],
    ['GET', '/api/attendance?start=2026-06-10&end=2026-06-10&mine=true', null, [200], 'attendance'],
    ['GET', '/api/notes', null, [200], 'notes'],
    ['GET', '/api/calendar?start=2026-06-01&end=2026-06-30', null, [200], 'calendar'],
    ['POST', '/api/notes', { title: 'E2E member note', content: 'probe', workspace: 'GENERAL' }, [200, 201], 'notes_create'],
  ];

  for (const [method, path, body, expect, label] of probes) {
    const res = await req(method, path, body);
    results.pages.push(label);
    if (expect.includes(res.status)) pass(label, `HTTP ${res.status}`);
    else fail(label, `Expected ${expect.join('|')} got ${res.status}: ${res.body?.error || ''}`);
  }

  const forbidden = [
    ['PUT', `/api/projects/${SANDBOX_ID}`, { name: 'Hacked' }, [403], 'forbid_project_rename'],
    ['GET', '/api/admin/users', null, [403, 404], 'forbid_admin_users'],
    ['GET', '/api/data-hub/backups', null, [403, 404], 'forbid_data_hub'],
  ];

  for (const [method, path, body, expect, label] of forbidden) {
    const res = await req(method, path, body);
    if (expect.includes(res.status)) pass(label, `HTTP ${res.status}`);
    else fail(label, `Expected ${expect.join('|')} got ${res.status}`);
  }

  const tasks = await req('GET', `/api/tasks?projectId=${SANDBOX_ID}`);
  const taskPayload = tasks.body?.tasks || tasks.body || [];
  const count = Array.isArray(taskPayload) ? taskPayload.length : 0;
  pass('task_list_count', `${count} tasks on sandbox`);

  console.log(JSON.stringify(results, null, 2));
  process.exit(results.bugs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
