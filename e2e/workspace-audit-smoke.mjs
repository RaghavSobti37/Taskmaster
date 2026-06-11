/**
 * Workspace pages API smoke — admin, sales, viewer
 * Run: node e2e/workspace-audit-smoke.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const MANIFEST = path.resolve('.agents/e2e-users.json');
const API = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
const OUT = path.resolve('.agents/workspace-audit-results.json');
const API_URL = new URL(API);

function httpRequest(method, pathname, { cookie, body } = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.Cookie = cookie;
    const req = http.request(
      { hostname: API_URL.hostname, port: API_URL.port || 80, path: pathname, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* */ }
          resolve({ status: res.statusCode || 0, ok: res.statusCode >= 200 && res.statusCode < 300, json, text: text.slice(0, 500) });
        });
      },
    );
    req.on('error', (err) => resolve({ status: 0, ok: false, json: null, text: err.message, error: true }));
    if (payload) req.write(payload);
    req.end();
  });
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const sandbox = manifest.projects.find((p) => p.name === '[E2E] SANDBOX');
const secondary = manifest.projects.find((p) => p.name === '[E2E] SECONDARY');

const ROLES = [
  { key: 'admin', archetype: 'dept-admin' },
  { key: 'sales', archetype: 'dept-sales' },
  { key: 'viewer', archetype: 'dept-editor' },
];

/** @type {Array<{page:string,role:string,endpoint:string,pass:boolean,detail:string,severity?:string}>} */
const results = [];
/** @type {Array<{id:string,severity:string,title:string,detail:string}>} */
const bugs = [];

function record(page, role, endpoint, pass, detail, severity) {
  results.push({ page, role, endpoint, pass, detail });
  if (!pass && severity) {
    const id = `BUG-WS-${bugs.length + 1}`;
    if (!bugs.some((b) => b.title === endpoint && b.detail === detail)) {
      bugs.push({ id, severity, title: `${page}: ${endpoint}`, detail });
    }
  }
}

async function login(email, password) {
  const res = await httpRequest('POST', '/api/auth/login', { body: { email, password } });
  const raw = res.headers?.['set-cookie'];
  const setCookie = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies = (res.headers && Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [])
    .map((entry) => {
      const [pair] = entry.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      if (eq < 0 || entry.includes('Max-Age=0')) return null;
      return pair;
    })
    .filter(Boolean)
    .join('; ');
  // fix: res.headers from httpRequest doesn't include set-cookie in our wrapper
  const hdr = res;
  return { cookie: cookies, user: res.json?.user || res.json, loginStatus: res.status };
}

async function api(method, pathname, cookie, body) {
  return httpRequest(method, pathname, { cookie, body });
}

// Fix login cookie parsing — re-read from raw response
async function apiLogin(email, password) {
  const res = await httpRequest('POST', '/api/auth/login', { body: { email, password } });
  return new Promise((resolve) => {
    const payload = JSON.stringify({ email, password });
    const req = http.request(
      { hostname: API_URL.hostname, port: API_URL.port || 80, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (r) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* */ }
          const setCookie = r.headers['set-cookie'] || [];
          const cookies = setCookie
            .map((entry) => {
              const [pair] = entry.split(';').map((s) => s.trim());
              if (entry.includes('Max-Age=0')) return null;
              return pair;
            })
            .filter(Boolean)
            .join('; ');
          resolve({ cookie: cookies, user: json?.user || json, status: r.statusCode });
        });
      },
    );
    req.on('error', (err) => resolve({ cookie: '', user: null, status: 0, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function smokeRole(roleKey, user) {
  const session = await apiLogin(user.email, user.password);
  const { cookie } = session;
  if (session.status !== 200) {
    record('auth', roleKey, 'login', false, `status ${session.status}`, 'critical');
    return;
  }

  // Dashboard
  const dash = await api('GET', '/api/dashboard/summary', cookie);
  record('Dashboard', roleKey, 'GET /api/dashboard/summary', dash.status === 200, `status ${dash.status}`);

  const preset = await api('GET', '/api/customization/dashboard/preset', cookie);
  record('Dashboard', roleKey, 'GET /api/customization/dashboard/preset', preset.status === 200, `status ${preset.status}`);

  // Tasks
  const tasks = await api('GET', '/api/tasks?includeOldCompleted=1', cookie);
  record('Tasks', roleKey, 'GET /api/tasks', tasks.status === 200, `status ${tasks.status} count=${Array.isArray(tasks.json) ? tasks.json.length : tasks.json?.tasks?.length ?? '?'}`);

  // Projects list
  const projects = await api('GET', '/api/projects', cookie);
  const projList = Array.isArray(projects.json) ? projects.json : projects.json?.projects || [];
  record('Projects', roleKey, 'GET /api/projects', projects.status === 200, `status ${projects.status} count=${projList.length}`);

  // Project IDOR — secondary project (sales/viewer not member)
  if (secondary?.projectId) {
    const idor = await api('GET', `/api/projects/${secondary.projectId}`, cookie);
    const expect403 = roleKey !== 'admin' && !user.projectRoles?.some((r) => r.project === '[E2E] SECONDARY');
    const idorPass = expect403 ? idor.status === 403 : idor.status === 200;
    record('Projects', roleKey, 'GET /api/projects/:id IDOR', idorPass, `secondary status ${idor.status} expect403=${expect403}`, idorPass ? undefined : 'high');
  }

  // Project sub-routes
  const myProjectId = user.projectRoles?.some((r) => r.project === '[E2E] SANDBOX') ? sandbox?.projectId : secondary?.projectId;
  if (myProjectId) {
    const detail = await api('GET', `/api/projects/${myProjectId}`, cookie);
    record('Projects', roleKey, 'GET /api/projects/:id (member)', detail.status === 200, `status ${detail.status}`);
    const analytics = await api('GET', `/api/projects/${myProjectId}/workload`, cookie);
    record('Projects', roleKey, 'GET /api/projects/:id/workload', analytics.status === 200, `status ${analytics.status}`);
  }

  // Logs
  const logs = await api('GET', '/api/logs?limit=10', cookie);
  record('Logs', roleKey, 'GET /api/logs', logs.status === 200, `status ${logs.status}`);

  const otherUser = manifest.users.find((u) => u.archetype === 'dept-admin');
  if (otherUser && roleKey !== 'admin') {
    const scope = await api('GET', `/api/logs?userId=${otherUser.userId}&limit=5`, cookie);
    record('Logs', roleKey, 'GET /api/logs?userId=other', scope.status === 403, `status ${scope.status} (expect 403)`, scope.status === 403 ? undefined : 'high');
  }

  // Teams — GET /api/teams admin-only (matches /admin/teams UI gate)
  const teams = await api('GET', '/api/teams', cookie);
  const teamsOk = roleKey === 'admin' ? teams.status === 200 : teams.status === 403;
  record('Teams', roleKey, 'GET /api/teams', teamsOk, `status ${teams.status} (expect ${roleKey === 'admin' ? 200 : 403})`);

  // Inbox / Notifications
  const notifs = await api('GET', '/api/notifications', cookie);
  const notifOk = notifs.status === 200 && (notifs.json?.localOnly === true || Array.isArray(notifs.json?.notifications));
  record('Inbox', roleKey, 'GET /api/notifications', notifOk, `status ${notifs.status} localOnly=${notifs.json?.localOnly}`);

  // Pinboard
  const pin = await api('GET', '/api/pinboard', cookie);
  record('Pinboard', roleKey, 'GET /api/pinboard', pin.status === 200, `status ${pin.status}`);

  // Search
  const search = await api('GET', '/api/search?q=e2e&limit=5', cookie);
  record('Search', roleKey, 'GET /api/search', search.status === 200, `status ${search.status}`);

  // Task ACL — viewer mutate
  if (roleKey === 'viewer' && sandbox?.projectId) {
    const tasksOnSandbox = await api('GET', `/api/tasks?projectId=${sandbox.projectId}`, cookie);
    const first = (Array.isArray(tasksOnSandbox.json) ? tasksOnSandbox.json : tasksOnSandbox.json?.tasks || [])[0];
    if (first?._id) {
      const mut = await api('PATCH', `/api/tasks/${first._id}`, cookie, { title: 'viewer hijack' });
      record('Tasks', roleKey, 'PATCH /api/tasks/:id ACL', mut.status === 403, `status ${mut.status}`, mut.status === 403 ? undefined : 'high');
    }
  }

  // Sales member assign off-project
  if (roleKey === 'sales' && sandbox?.projectId) {
    const offUser = manifest.users.find((u) => u.archetype === 'dept-cg-artist');
    const create = await api('POST', '/api/tasks', cookie, {
      title: `[WS Audit] assign ${Date.now()}`,
      projectId: sandbox.projectId,
      status: 'todo',
      assignees: [user.userId, offUser?.userId].filter(Boolean),
    });
    if (create.status === 201 && offUser) {
      const bad = create.json?.assignees?.some((a) => String(a._id || a) === offUser.userId);
      record('Tasks', roleKey, 'POST assign off-project blocked', !bad, `create status ${create.status} leaked=${bad}`, bad ? 'high' : undefined);
      if (create.json?._id) await api('DELETE', `/api/tasks/${create.json._id}`, cookie);
    }
  }
}

async function main() {
  console.log('[Workspace Audit] API smoke…');
  const health = await httpRequest('GET', '/api/health');
  record('infra', 'all', 'GET /api/health', health.status === 200, `status ${health.status}`);

  for (const { key, archetype } of ROLES) {
    const user = manifest.users.find((u) => u.archetype === archetype);
    if (!user) continue;
    console.log(`  → ${key} (${archetype})`);
    await smokeRole(key, user);
    await new Promise((r) => setTimeout(r, 200));
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const out = { api: API, passed, failed, total: results.length, results, bugs, finished: new Date().toISOString() };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\n[Workspace Audit] ${passed}/${results.length} passed, ${bugs.length} bugs`);
  console.log(`Results: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
