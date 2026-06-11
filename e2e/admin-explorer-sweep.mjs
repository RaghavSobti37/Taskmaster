/**
 * Admin explorer sweep — visits App.jsx routes, logs console/network issues.
 * Run: node e2e/admin-explorer-sweep.mjs
 */
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const MANIFEST = path.resolve('.agents/e2e-users.json');
function loadAdminCreds() {
  if (fs.existsSync(MANIFEST)) {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const admin = m.users?.find((u) => u.archetype === 'dept-admin' || u.department?.slug === 'admin');
    if (admin?.email && admin?.password) return { email: admin.email, password: admin.password, source: 'e2e-users.json' };
  }
  return {
    email: process.env.E2E_EMAIL || 'e2e-user@example.com',
    password: process.env.E2E_PASSWORD || '1Million#',
    source: 'fallback',
  };
}

const { email: EMAIL, password: PASSWORD, source: CRED_SOURCE } = loadAdminCreds();
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
const OUT = path.resolve('e2e/.admin-explorer-results.json');

const STATIC_ROUTES = [
  '/dashboard',
  '/projects',
  '/projects/new',
  '/calendar',
  '/settings',
  '/logs',
  '/attendance',
  '/attendance/all',
  '/schedule',
  '/inbox',
  '/todo',
  '/notes',
  '/notes/new',
  '/components',
  '/crm',
  '/crm?tab=leads',
  '/crm?tab=followups',
  '/crm?tab=bookings',
  '/office',
  '/office?tab=equipment',
  '/office?tab=contacts',
  '/office?tab=subscriptions',
  '/management',
  '/management?tab=finance',
  '/management?tab=announcements',
  '/management?tab=ops-logs',
  '/management?tab=artists',
  '/admin/console',
  '/assets',
  '/assets/accounts',
  '/office-assets',
  '/features',
  '/workflows',
  '/admin/artist-path',
  '/admin',
  '/admin/control',
  '/admin/qa',
  '/admin/users',
  '/admin/teams',
  '/admin/roles',
  '/admin/exly-campaigns',
  '/admin/scripts',
  '/admin/gamification',
  '/admin/project-analytics',
  '/emails',
  '/emails/campaigns',
  '/emails/templates',
  '/emails/profiles',
  '/emails/analytics',
  '/emails/newsletter',
  '/emails/newsletter/curate',
  '/emails/create',
  '/logs?view=lead-audits',
];

async function apiLogin() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`);
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookies = setCookie
    .map((raw) => {
      const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      if (eq < 0) return null;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (!value || raw.includes('Max-Age=0')) return null;
      const cookie = { name, value, path: '/', domain: 'localhost', httpOnly: true, sameSite: 'Lax' };
      for (const a of attrs) {
        if (/^Secure$/i.test(a)) cookie.secure = false;
        if (/^Path=/i.test(a)) cookie.path = a.split('=')[1];
      }
      return cookie;
    })
    .filter(Boolean);
  const body = await res.json();
  return { cookies, user: body.user || body };
}

async function apiGet(pathname, cookies) {
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const res = await fetch(`${API}${pathname}`, { headers: { Cookie: cookieHeader } });
  return { status: res.status, ok: res.ok, body: res.ok ? await res.json().catch(() => null) : await res.text() };
}

async function discoverDynamicRoutes(cookies) {
  const routes = [];
  const projects = await apiGet('/api/projects?limit=3', cookies);
  const list = projects.body?.projects || projects.body?.data || projects.body || [];
  const arr = Array.isArray(list) ? list : [];
  for (const p of arr.slice(0, 2)) {
    const id = p._id || p.id;
    if (id) {
      routes.push(`/projects/${id}`);
      routes.push(`/projects/${id}/analytics`);
    }
  }
  const workspaces = await apiGet('/api/workspaces', cookies);
  const wsList = workspaces.body?.workspaces || workspaces.body?.data || workspaces.body || [];
  const wsArr = Array.isArray(wsList) ? wsList : [];
  for (const w of wsArr.slice(0, 1)) {
    const name = w.name || w.slug;
    if (name) routes.push(`/workspaces/${encodeURIComponent(name)}`);
  }
  const notes = await apiGet('/api/notes?limit=1', cookies);
  const noteList = notes.body?.notes || notes.body?.data || notes.body || [];
  const noteArr = Array.isArray(noteList) ? noteList : [];
  for (const n of noteArr.slice(0, 1)) {
    const id = n._id || n.id;
    if (id) routes.push(`/notes/${id}`);
  }
  const campaigns = await apiGet('/api/campaigns?limit=1', cookies);
  const campList = campaigns.body?.campaigns || campaigns.body?.data || campaigns.body || [];
  const campArr = Array.isArray(campList) ? campList : [];
  for (const c of campArr.slice(0, 1)) {
    const id = c._id || c.id || c.campaignId;
    if (id) routes.push(`/campaign/${id}`);
  }
  const artists = await apiGet('/api/artists?limit=1', cookies);
  const artistList = artists.body?.artists || artists.body?.data || artists.body || [];
  const artistArr = Array.isArray(artistList) ? artistList : [];
  for (const a of artistArr.slice(0, 1)) {
    const id = a._id || a.id;
    if (id) routes.push(`/artists/${id}`);
  }
  return routes;
}

async function runCrudSmoke(cookies) {
  const crud = [];
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const ts = Date.now();
  const createProject = await fetch(`${API}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      name: `E2E Admin Sweep ${ts}`,
      description: 'Auto CRUD smoke',
      status: 'active',
    }),
  });
  crud.push({ action: 'POST /api/projects', status: createProject.status, ok: createProject.ok });
  let projectId = null;
  if (createProject.ok) {
    const pj = await createProject.json();
    projectId = pj._id || pj.id || pj.project?._id;
    if (projectId) {
      const patch = await fetch(`${API}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({ description: 'Updated by admin sweep' }),
      });
      crud.push({ action: `PATCH /api/projects/${projectId}`, status: patch.status, ok: patch.ok });
      const del = await fetch(`${API}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Cookie: cookieHeader },
      });
      crud.push({ action: `DELETE /api/projects/${projectId}`, status: del.status, ok: del.ok });
    }
  }

  const createTask = await fetch(`${API}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ title: `E2E task ${ts}`, status: 'todo', priority: 'medium' }),
  });
  crud.push({ action: 'POST /api/tasks', status: createTask.status, ok: createTask.ok });
  if (createTask.ok) {
    const t = await createTask.json();
    const taskId = t._id || t.id || t.task?._id;
    if (taskId) {
      const patchT = await fetch(`${API}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({ status: 'done' }),
      });
      crud.push({ action: `PATCH /api/tasks/${taskId}`, status: patchT.status, ok: patchT.ok });
      const delT = await fetch(`${API}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Cookie: cookieHeader },
      });
      crud.push({ action: `DELETE /api/tasks/${taskId}`, status: delT.status, ok: delT.ok });
    }
  }

  for (const ep of ['/api/data-hub/folders', '/api/crm/leads?limit=1', '/api/campaigns?limit=1', '/api/admin/scripts']) {
    const r = await apiGet(ep, cookies);
    crud.push({ action: `GET ${ep}`, status: r.status, ok: r.ok });
  }

  return crud;
}

function isBlank(pageText) {
  const t = (pageText || '').replace(/\s+/g, ' ').trim();
  return t.length < 20;
}

async function visitRoute(page, route) {
  const result = {
    route,
    finalUrl: '',
    status: 'ok',
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    api403: [],
    blank: false,
    notes: [],
  };

  const onConsole = (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err) => result.pageErrors.push(String(err.message || err).slice(0, 300));
  const onResponse = (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    const st = res.status();
    if (st >= 400) {
      result.failedRequests.push({ url: url.replace(BASE, '').replace(API, ''), status: st });
      if (st === 403) result.api403.push(url);
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    result.finalUrl = page.url();
    if (resp && resp.status() >= 400) result.notes.push(`HTTP ${resp.status()}`);
    if (result.finalUrl.includes('/login')) {
      result.status = 'redirect_login';
    } else if (result.finalUrl !== `${BASE}${route}` && !result.finalUrl.includes(route.split('?')[0])) {
      result.notes.push(`redirected to ${result.finalUrl.replace(BASE, '')}`);
    }
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (isBlank(bodyText) && !result.finalUrl.includes('/login')) {
      result.blank = true;
      result.status = 'blank';
    }
    if (result.consoleErrors.length) result.status = result.status === 'ok' ? 'console_errors' : result.status;
    if (result.pageErrors.length) result.status = 'page_error';
    if (result.api403.length) result.status = 'api_403';
  } catch (err) {
    result.status = 'navigation_error';
    result.notes.push(String(err.message || err).slice(0, 200));
  } finally {
    page.removeListener('console', onConsole);
    page.removeListener('pageerror', onPageError);
    page.removeListener('response', onResponse);
  }

  return result;
}

async function main() {
  const started = new Date().toISOString();
  let auth;
  try {
    auth = await apiLogin();
  } catch (e) {
    console.error('API login failed:', e.message);
    process.exit(1);
  }

  const dynamicRoutes = await discoverDynamicRoutes(auth.cookies);
  const allRoutes = [...new Set([...STATIC_ROUTES, ...dynamicRoutes])];
  const crud = await runCrudSmoke(auth.cookies);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE });
  await context.addCookies(auth.cookies);
  const page = await context.newPage();

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) {
    throw new Error('Cookie auth failed — redirected to login');
  }

  const visits = [];
  for (const route of allRoutes) {
    process.stderr.write(`visit ${route}\n`);
    visits.push(await visitRoute(page, route));
  }

  await browser.close();

  const bugs = visits.filter(
    (v) =>
      v.status !== 'ok' ||
      v.consoleErrors.length ||
      v.pageErrors.length ||
      v.failedRequests.some((r) => r.status >= 500) ||
      v.blank
  );
  const crudFails = crud.filter((c) => !c.ok && c.status !== 404);

  const report = {
    started,
    finished: new Date().toISOString(),
    user: EMAIL,
    credSource: CRED_SOURCE,
    baseURL: BASE,
    pagesVisited: visits.length,
    routes: allRoutes,
    visits,
    crud,
    bugCount: bugs.length + crudFails.length,
    bugs,
    crudFails,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pagesVisited: visits.length, bugCount: report.bugCount, out: OUT }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
