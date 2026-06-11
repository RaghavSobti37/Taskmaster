/**
 * Admin API audit — curl-equivalent checks per admin page.
 * Run: node e2e/admin-api-audit.mjs
 */
import fs from 'fs';
import path from 'path';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
const EMAIL = process.env.E2E_EMAIL || 'e2e-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD || '1Million#';
const OUT = path.resolve('e2e/.admin-api-audit.json');

const ENDPOINTS_BY_PAGE = {
  '/admin': [
    '/api/data-hub/folders',
    '/api/data-hub/people?limit=5',
    '/api/data-hub/analytics?folder=all',
    '/api/data-hub/sync-status',
    '/api/data-hub/backups',
  ],
  '/admin/console': [],
  '/admin/control': [
    '/api/users/directory?limit=10',
    '/api/teams',
    '/api/crm/stats',
    '/api/mail/stats',
  ],
  '/admin/qa': ['/api/qa/lighthouse-routes', '/api/qa/history'],
  '/admin/users': [
    '/api/users/directory?limit=10',
    '/api/departments',
    '/api/crm/stats',
    '/api/mail/stats',
  ],
  '/admin/teams': ['/api/users/directory?limit=10', '/api/departments'],
  '/admin/roles': ['/api/admin/roles'],
  '/admin/artist-path': ['/api/artist-path/people?limit=5'],
  '/admin/exly-campaigns': [
    '/api/exly/config',
    '/api/exly/offerings',
    '/api/exly/dashboard-stats',
    '/api/exly/unlinked-bookings',
  ],
  '/admin/scripts': ['/api/admin/scripts', '/api/admin/queues/status'],
  '/admin/gamification': ['/api/gamification-admin/rules'],
  '/admin/project-analytics': [
    '/api/projects?limit=5',
    '/api/projects/analytics-summary?timeframe=30d',
  ],
};

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${res.status}: ${await res.text()}`);
  const cookies = (res.headers.getSetCookie?.() || [])
    .map((raw) => {
      const [pair] = raw.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      if (eq < 0) return null;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (!value || raw.includes('Max-Age=0')) return null;
      return `${name}=${value}`;
    })
    .filter(Boolean)
    .join('; ');
  const body = await res.json();
  return { cookies, user: body.user || body };
}

async function get(pathname, cookies) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Cookie: cookies },
    signal: AbortSignal.timeout(30000),
  });
  let bodyPreview = '';
  try {
    const text = await res.text();
    bodyPreview = text.slice(0, 200);
  } catch {
    bodyPreview = '';
  }
  return { pathname, status: res.status, ok: res.ok, bodyPreview };
}

async function main() {
  const auth = await login();
  const results = [];
  const seen = new Set();

  for (const [page, eps] of Object.entries(ENDPOINTS_BY_PAGE)) {
    for (const ep of eps) {
      if (seen.has(ep)) continue;
      seen.add(ep);
      const r = await get(ep, auth.cookies);
      results.push({ page, ...r });
    }
  }

  // Unauthenticated probe — should 401/403 not 500
  const unauth = [];
  for (const ep of ['/api/admin/roles', '/api/data-hub/folders', '/api/admin/scripts']) {
    const res = await fetch(`${API}${ep}`, { signal: AbortSignal.timeout(10000) });
    unauth.push({ pathname: ep, status: res.status });
  }

  const fails = results.filter((r) => r.status >= 500);
  const forbidden = results.filter((r) => r.status === 403);
  const notFound = results.filter((r) => r.status === 404);
  const clientErrors = results.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 403);

  const report = {
    auditedAt: new Date().toISOString(),
    user: EMAIL,
    api: API,
    endpointCount: results.length,
    results,
    unauth,
    summary: {
      ok: results.filter((r) => r.ok).length,
      fails: fails.length,
      forbidden: forbidden.length,
      notFound: notFound.length,
      clientErrors: clientErrors.length,
    },
    fails,
    forbidden,
    notFound,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
