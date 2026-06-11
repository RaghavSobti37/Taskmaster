/**
 * Task Explorer sweep — API edge cases for all E2E user archetypes.
 * Run: node e2e/task-explorer-sweep.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const MANIFEST = path.resolve('.agents/e2e-users.json');
const API = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
const OUT = path.resolve('e2e/.task-explorer-results.json');
const API_URL = new URL(API);

/** Node fetch on Windows can ECONNRESET on POST — use http.request */
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
      {
        hostname: API_URL.hostname,
        port: API_URL.port || 80,
        path: pathname,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const ct = res.headers['content-type'] || '';
          let json = null;
          if (ct.includes('application/json')) {
            try { json = JSON.parse(text); } catch { json = null; }
          }
          resolve({
            status: res.statusCode || 0,
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            json,
            text,
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', (err) => {
      resolve({ status: 0, ok: false, json: null, text: err.message, error: true });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const users = manifest.users;
let sandbox = manifest.projects.find((p) => p.name === '[E2E] SANDBOX');
let secondary = manifest.projects.find((p) => p.name === '[E2E] SECONDARY');

/** @type {Array<{ id: string, severity: string, title: string, detail: string, repro?: string }>} */
const bugs = [];
/** @type {Array<{ name: string, pass: boolean, detail?: string }>} */
const tests = [];

function bug(id, severity, title, detail, repro) {
  if (!bugs.some((b) => b.id === id)) bugs.push({ id, severity, title, detail, repro });
}

function test(name, pass, detail = '') {
  tests.push({ name, pass, detail });
}

function userByArchetype(archetype) {
  return users.find((u) => u.archetype === archetype);
}

async function apiLogin(email, password) {
  const res = await httpRequest('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (!res.ok) throw new Error(`Login ${email} failed ${res.status}: ${res.text?.slice(0, 120)}`);
  const raw = res.headers['set-cookie'];
  const setCookie = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies = setCookie
    .map((entry) => {
      const [pair] = entry.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      if (eq < 0) return null;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (!value || entry.includes('Max-Age=0')) return null;
      return `${name}=${value}`;
    })
    .filter(Boolean)
    .join('; ');
  return { cookie: cookies, user: res.json?.user || res.json };
}

async function api(method, pathname, cookie, body) {
  return httpRequest(method, pathname, { cookie, body });
}

function taskIdFromCreate(json) {
  if (!json) return null;
  return json._id || json.id || json.task?._id || null;
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function runArchetypeFlow(actor, sessions) {
  const { cookie, user } = sessions[actor.archetype];
  const ts = Date.now();
  const label = actor.archetype;

  const projectId = actor.projectRoles?.some((r) => r.project === '[E2E] SANDBOX')
    ? sandbox?.projectId
    : secondary?.projectId;

  const isLead = actor.projectRoles?.some((r) => r.role === 'lead');
  const isMember = actor.projectRoles?.some((r) => r.role === 'member');
  const isViewer = actor.projectRoles?.some((r) => r.role === 'viewer');

  // Create task (self-assigned)
  const createSelf = await api('POST', '/api/tasks', cookie, {
    title: `[E2E Task] ${label} self ${ts}`,
    status: 'todo',
    priority: 'medium',
    projectId,
    dueDate: tomorrowIso(),
  });
  const createOk = isViewer ? createSelf.status === 403 : createSelf.status === 201;
  test(`${label}: create task self`, createOk, `status ${createSelf.status}`);
  const taskId = taskIdFromCreate(createSelf.json);
  if (isViewer && createSelf.status === 403) {
    return { taskId: null };
  }
  if (createSelf.status !== 201) {
    if (createSelf.status === 0) {
      bug('BUG-T0', 'critical', 'API connection dropped during task create', `${label} POST /api/tasks fetch failed`);
    }
    return { taskId: null };
  }
  if (!taskId) {
    bug(
      'BUG-T1',
      'high',
      'Task create response missing _id',
      `${label} POST /api/tasks 201 but no parseable id`,
      `POST /api/tasks as ${actor.email}`,
    );
    return { taskId: null };
  }

  // Activity after create
  const actCreate = await api('GET', `/api/tasks/${taskId}/activity`, cookie);
  test(`${label}: activity after create`, actCreate.status === 200, `status ${actCreate.status}`);
  const actItems = Array.isArray(actCreate.json) ? actCreate.json : actCreate.json?.items || [];
  const hasCreated = actItems.some((a) => a.type === 'created');
  test(`${label}: activity has created`, hasCreated, `types: ${actItems.map((a) => a.type).join(',')}`);
  if (actCreate.status === 200 && !hasCreated) {
    bug(
      'BUG-T2',
      'medium',
      'Task activity missing created entry',
      `${label} GET activity after create — no type=created`,
      `GET /api/tasks/${taskId}/activity`,
    );
  }

  // PATCH status via PUT and PATCH (admin explorer reported PATCH 404)
  const patchPut = await api('PUT', `/api/tasks/${taskId}`, cookie, { status: 'in-progress' });
  test(`${label}: PUT update status`, patchPut.status === 200, `status ${patchPut.status}`);
  const patchPatch = await api('PATCH', `/api/tasks/${taskId}`, cookie, { priority: 'high' });
  test(`${label}: PATCH update priority`, patchPatch.status === 200, `status ${patchPatch.status}`);
  if (patchPatch.status === 404) {
    bug(
      'BUG-T3',
      'medium',
      'Task PATCH returns 404',
      `${label} PATCH /api/tasks/:id → 404 (PUT may work)`,
      `PATCH /api/tasks/${taskId}`,
    );
  }

  // Assign other (if lead/admin on project)
  const sandboxMember = userByArchetype('dept-sales');
  const offProjectUser = userByArchetype('dept-cg-artist');

  if (isLead && sandboxMember && projectId === sandbox?.projectId) {
    const assignOther = await api('PATCH', `/api/tasks/${taskId}`, cookie, {
      assignees: [actor.userId, sandboxMember.userId],
    });
    test(`${label}: assign other member`, assignOther.status === 200, `status ${assignOther.status}`);
    const actAssign = await api('GET', `/api/tasks/${taskId}/activity`, cookie);
    const assignItems = Array.isArray(actAssign.json) ? actAssign.json : [];
    const hasAssignment = assignItems.some((a) => a.type === 'assignment');
    test(`${label}: activity has assignment`, hasAssignment, `types: ${assignItems.map((a) => a.type).join(',')}`);
    if (assignOther.status === 200 && !hasAssignment) {
      bug(
        'BUG-T4',
        'medium',
        'Reassign missing activity entry',
        `${label} assign other — no assignment in activity stream`,
        `PATCH assignees then GET activity`,
      );
    }
  }

  if (isMember && sandboxMember?.userId === actor.userId && offProjectUser) {
    const badAssign = await api('PATCH', `/api/tasks/${taskId}`, cookie, {
      assignees: [offProjectUser.userId],
    });
    const blocked = badAssign.status === 403 || badAssign.status === 400;
    test(`${label}: member cannot assign off-project`, blocked, `status ${badAssign.status}`);
    if (!blocked && badAssign.status === 200) {
      bug(
        'BUG-T5',
        'high',
        'Member can assign task to non-project user',
        `dept-sales assigned off-project user — got 200`,
      );
    }
  }

  // Viewer mutate attempt
  if (isViewer) {
    const viewerPatch = await api('PATCH', `/api/tasks/${taskId}`, cookie, { title: 'Viewer hijack' });
    test(`${label}: viewer mutate blocked`, viewerPatch.status === 403, `status ${viewerPatch.status}`);
    if (viewerPatch.status !== 403) {
      bug(
        'BUG-T6',
        'high',
        'Viewer role can mutate tasks',
        `dept-editor PATCH task → ${viewerPatch.status} (expected 403). shared/projectRoles.js maps viewer→member`,
        `PATCH /api/tasks/${taskId} as viewer`,
      );
    }
    // cleanup — delete if viewer somehow owns task
    await api('DELETE', `/api/tasks/${taskId}`, cookie);
    return { taskId };
  }

  // Complete task
  const complete = await api('PATCH', `/api/tasks/${taskId}`, cookie, { status: 'done' });
  test(`${label}: complete task`, complete.status === 200, `status ${complete.status} final=${complete.json?.status}`);
  const doneStatus = complete.json?.status;
  if (complete.status === 200 && doneStatus && doneStatus !== 'done' && doneStatus !== 'in-review') {
    bug(
      'BUG-T7',
      'medium',
      'Complete task unexpected status',
      `${label} PATCH done → status=${doneStatus}`,
    );
  }

  // Activity status_change
  const actDone = await api('GET', `/api/tasks/${taskId}/activity`, cookie);
  const doneItems = Array.isArray(actDone.json) ? actDone.json : [];
  const hasStatus = doneItems.some((a) => a.type === 'status_change');
  test(`${label}: activity status_change`, hasStatus, `types: ${doneItems.map((a) => a.type).join(',')}`);

  // Reopen (lead/creator)
  if (isLead || actor.archetype === 'dept-admin') {
    const reopen = await api('PATCH', `/api/tasks/${taskId}`, cookie, { status: 'in-progress' });
    test(`${label}: reopen completed`, reopen.status === 200, `status ${reopen.status}`);
    if (reopen.status === 403) {
      bug(
        'BUG-T8',
        'medium',
        'Lead cannot reopen completed task',
        `${label} reopen → 403`,
      );
    }
  }

  // Rollback via reviewAction (if was in-review path — try on done)
  if (isLead) {
    const rollback = await api('PATCH', `/api/tasks/${taskId}`, cookie, {
      reviewAction: 'rollback',
      description: 'E2E rollback test',
    });
    const rbOk = rollback.status === 200 || rollback.status === 400;
    test(`${label}: rollback attempt`, rbOk, `status ${rollback.status} ${rollback.json?.error || ''}`);
    if (rollback.status === 200) {
      const actRb = await api('GET', `/api/tasks/${taskId}/activity`, cookie);
      const rbItems = Array.isArray(actRb.json) ? actRb.json : [];
      const hasRb = rbItems.some((a) => a.type === 'rollback');
      test(`${label}: rollback activity`, hasRb, `types: ${rbItems.map((a) => a.type).join(',')}`);
      if (!hasRb) {
        bug('BUG-T9', 'low', 'Rollback missing activity entry', `${label} rollback OK but no rollback activity`);
      }
    }
  }

  // Daily log link — POST log referencing task
  const dailyLog = await api('POST', '/api/logs', cookie, {
    action: 'DAILY_LOG',
    targetType: 'Task',
    targetId: taskId,
    details: { type: 'TASK_COMPLETION', timeSpent: '30m', taskTitle: createSelf.json?.title },
  });
  test(`${label}: daily log link task`, dailyLog.status === 201, `status ${dailyLog.status}`);
  if (dailyLog.status !== 201) {
    bug(
      'BUG-T10',
      'low',
      'Daily log cannot link to task',
      `${label} POST /api/logs with targetId=task → ${dailyLog.status}`,
    );
  }

  // Filters
  if (projectId) {
    const filtPriority = await api('GET', `/api/tasks?projectId=${projectId}&priority=high`, cookie);
    test(`${label}: filter priority`, filtPriority.status === 200, `status ${filtPriority.status}`);
    const filtDue = await api('GET', `/api/tasks?projectId=${projectId}&dueBefore=${tomorrowIso()}`, cookie);
    test(`${label}: filter due`, filtDue.status === 200, `status ${filtDue.status}`);
  }

  // Notification API (localOnly — document if empty)
  const notifs = await api('GET', '/api/notifications', cookie);
  test(`${label}: notifications endpoint`, notifs.status === 200, `localOnly=${notifs.json?.localOnly}`);
  if (notifs.json?.localOnly && !(notifs.json?.notifications?.length)) {
    // expected architecture — not a bug unless assign didn't fire realtime
  }

  // Cleanup
  await api('DELETE', `/api/tasks/${taskId}`, cookie);
  return { taskId };
}

async function runOffProjectAssignTest(sessions) {
  const lead = userByArchetype('dept-admin');
  const offProjectUser = userByArchetype('dept-cg-artist');
  if (!lead || !offProjectUser || !sessions[lead.archetype] || !sandbox?.projectId) return;

  const { cookie } = sessions[lead.archetype];
  const ts = Date.now();
  const create = await api('POST', '/api/tasks', cookie, {
    title: `[E2E Off-project assign] ${ts}`,
    status: 'todo',
    projectId: sandbox.projectId,
    assignees: [lead.userId],
  });
  const taskId = taskIdFromCreate(create.json);
  if (create.status !== 201 || !taskId) {
    test('off-project: setup create', false, `status ${create.status}`);
    return;
  }

  const badAssign = await api('PATCH', `/api/tasks/${taskId}`, cookie, {
    assignees: [offProjectUser.userId],
  });
  const graceful = badAssign.status === 403 || badAssign.status === 400;
  test('off-project: reject non-project assignee', graceful, `status ${badAssign.status}`);
  if (!graceful && badAssign.status === 200) {
    bug(
      'BUG-T5',
      'high',
      'Lead can assign task to non-project user',
      `dept-admin assigned ${offProjectUser.email} (SECONDARY only) on SANDBOX task — got 200`,
      'PATCH assignees=[off-project userId]',
    );
  }
  await api('DELETE', `/api/tasks/${taskId}`, cookie);
}

async function runNotificationAssignTest(sessions) {
  const lead = userByArchetype('dept-admin');
  const assignee = userByArchetype('dept-sales');
  if (!lead || !assignee || !sessions[lead.archetype] || !sessions[assignee.archetype]) return;
  const { cookie } = sessions[lead.archetype];
  const ts = Date.now();
  const create = await api('POST', '/api/tasks', cookie, {
    title: `[E2E Notify] ${ts}`,
    status: 'todo',
    projectId: sandbox.projectId,
    assignees: [assignee.userId],
  });
  test('notify: create with assignee', create.status === 201, `status ${create.status}`);
  // By design: server dispatches via WebSocket + push; inbox lives in client localStorage (localOnly stub).
  const assigneeNotifs = await api('GET', '/api/notifications', sessions[assignee.archetype].cookie);
  const localOnly = assigneeNotifs.json?.localOnly === true;
  const emptyInbox = (assigneeNotifs.json?.notifications?.length ?? 0) === 0;
  test(
    'notify: assignee GET /api/notifications (localOnly stub)',
    assigneeNotifs.status === 200 && localOnly && emptyInbox,
    `localOnly=${localOnly} count=${assigneeNotifs.json?.notifications?.length ?? 0} — inbox via WebSocket/localStorage, not REST`,
  );
  const taskId = taskIdFromCreate(create.json);
  if (taskId) await api('DELETE', `/api/tasks/${taskId}`, cookie);
}

async function runViewerCreateTest(sessions) {
  const viewer = userByArchetype('dept-editor');
  if (!viewer || !sessions[viewer.archetype]) return;
  const { cookie } = sessions[viewer.archetype];
  const create = await api('POST', '/api/tasks', cookie, {
    title: `[E2E Viewer create] ${Date.now()}`,
    status: 'todo',
    projectId: sandbox.projectId,
  });
  test('viewer: create task on project', create.status === 201 || create.status === 403, `status ${create.status}`);
  if (create.status === 201) {
    bug(
      'BUG-T12',
      'medium',
      'Viewer can create project tasks',
      'dept-editor (viewer on SANDBOX) POST /api/tasks → 201',
    );
    const id = taskIdFromCreate(create.json);
    if (id) await api('DELETE', `/api/tasks/${id}`, cookie);
  }
}

async function main() {
  const started = new Date().toISOString();
  console.log('[Task Explorer] API sweep starting…');

  // Reload manifest (seed may have run just before)
  const fresh = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  sandbox = fresh.projects.find((p) => p.name === '[E2E] SANDBOX');
  secondary = fresh.projects.find((p) => p.name === '[E2E] SECONDARY');
  const allUsers = fresh.users;
  users.length = 0;
  users.push(...allUsers);

  console.log(`Users: ${allUsers.length}, API: ${API}`);

  // Health
  const health = await httpRequest('GET', '/api/health');
  if (health.status !== 200) {
    bug('BUG-T0', 'critical', 'API not reachable', `GET /api/health → ${health.status}`);
    test('api health', false, String(health.status));
  } else {
    test('api health', true);
  }

  const sessions = {};
  for (const u of allUsers) {
    try {
      sessions[u.archetype] = await apiLogin(u.email, u.password);
      test(`login ${u.archetype}`, true);
    } catch (err) {
      test(`login ${u.archetype}`, false, err.message);
      bug('BUG-T0', 'critical', `Login failed ${u.archetype}`, err.message);
    }
  }

  for (const u of allUsers) {
    if (!sessions[u.archetype]) continue;
    console.log(`  → ${u.archetype}`);
    try {
      await runArchetypeFlow(u, sessions);
    } catch (err) {
      test(`${u.archetype}: flow error`, false, err.message);
      bug('BUG-T0', 'critical', `Flow crashed ${u.archetype}`, err.message);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  await runOffProjectAssignTest(sessions);

  await runNotificationAssignTest(sessions);
  await runViewerCreateTest(sessions);

  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.filter((t) => !t.pass).length;
  const finished = new Date().toISOString();

  const results = {
    started,
    finished,
    api: API,
    userCount: allUsers.length,
    testsRun: tests.length,
    passed,
    failed,
    tests,
    bugs,
  };

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`\n[Task Explorer] Done: ${passed}/${tests.length} passed, ${bugs.length} bugs`);
  console.log(`Results: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
