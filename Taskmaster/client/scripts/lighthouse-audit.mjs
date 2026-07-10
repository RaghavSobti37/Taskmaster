#!/usr/bin/env node
/**
 * Run Lighthouse on each app route sequentially and write a project summary.
 *
 * Usage:
 *   npm run lighthouse              # all routes (needs auth for protected)
 *   npm run lighthouse:public       # public routes only
 *   node scripts/lighthouse-audit.mjs --prod   # warn if not using preview (4173)
 *
 * Production benchmark (recommended):
 *   npm run build && npm run preview
 *   LH_BASE_URL=http://localhost:4173 npm run lighthouse
 *
 * Env:
 *   LH_BASE_URL       default http://localhost:5173 (use :4173 for prod preview)
 *   LH_API_URL        default http://localhost:5000 (login)
 *   LH_EMAIL / LH_PASSWORD   session for protected routes
 *   LH_COOKIE         manual Cookie header (overrides login)
 *   LH_ROUTES_EXTRA   comma paths, e.g. /projects/abc123
 *   LH_OUTPUT_DIR     default ./lighthouse-reports
 *   LH_SKIP_AUTH      1 = do not attempt login
 *
 * Prereq: client dev server (npm run dev) and API (server) for protected pages.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { resolveRoutes, PUBLIC_ROUTES } from './lighthouse-routes.mjs';
import {
  extractPageInsights,
  buildPerformanceMarkdown,
  buildDetailsHtml,
} from './lighthouse-insights.mjs';

const PUBLIC_ROUTE_PATHS = new Set(PUBLIC_ROUTES.map((r) => r.path));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, '..');

/** Optional local creds file (gitignored): LH_EMAIL=… LH_PASSWORD=… */
async function loadLocalLhEnv() {
  const envPath = path.join(CLIENT_ROOT, '.lighthouse.env');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key.startsWith('LH_') && !process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

const args = process.argv.slice(2);
const publicOnly = args.includes('--public-only');
const protectedOnly = args.includes('--protected-only');
const prodMode = args.includes('--prod');
const routeFilter = args.find((a) => a.startsWith('--route='))?.slice('--route='.length);
const minA11yArg = args.find((a) => a.startsWith('--min-a11y='))?.slice('--min-a11y='.length);
const minA11y = parseInt(process.env.LH_MIN_A11Y || minA11yArg || '0', 10);

const BASE_URL = (
  process.env.LH_BASE_URL || (prodMode ? 'http://localhost:4173' : 'http://localhost:5173')
).replace(/\/$/, '');
const API_URL = (process.env.LH_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const OUTPUT_DIR = path.resolve(
  CLIENT_ROOT,
  process.env.LH_OUTPUT_DIR || 'lighthouse-reports'
);
const extraPaths = (process.env.LH_ROUTES_EXTRA || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

function slugify(routePath) {
  if (routePath === '/') return 'home';
  return routePath.replace(/^\//, '').replace(/[/:]/g, '_') || 'root';
}

function scoreFromLhr(lhr, categoryId) {
  const cat = lhr.categories?.[categoryId];
  if (!cat || cat.score == null) return null;
  return Math.round(cat.score * 100);
}

async function checkServer(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function loginCookie() {
  if (process.env.LH_COOKIE?.trim()) {
    return process.env.LH_COOKIE.trim();
  }
  if (process.env.LH_SKIP_AUTH === '1') return null;

  const email = process.env.LH_EMAIL;
  const password = process.env.LH_PASSWORD;
  if (!email || !password) return null;

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Login failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const cookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [];

  if (cookies.length === 0) {
    const single = res.headers.get('set-cookie');
    if (single) cookies.push(single);
  }

  if (cookies.length === 0) {
    throw new Error('Login succeeded but no Set-Cookie header returned');
  }

  return cookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function buildSummaryHtml(rows, meta) {
  const avg = (key) => {
    const vals = rows.map((r) => r.scores[key]).filter((v) => v != null);
    if (!vals.length) return '—';
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const th = (label) => `<th scope="col">${label}</th>`;
  const td = (v, low) => {
    const cls = v == null ? 'na' : v < 50 ? 'bad' : v < 90 ? 'warn' : 'good';
    return `<td class="${cls}">${v ?? '—'}</td>`;
  };

  const bodyRows = rows
    .map((r) => {
      const file = `${slugify(r.path)}.report.html`;
      return `<tr>
        <td><a href="./pages/${file}">${r.name}</a><br><code>${r.path}</code></td>
        ${td(r.scores.performance)}
        ${td(r.scores.accessibility)}
        ${td(r.scores['best-practices'])}
        ${td(r.scores.seo)}
        <td>${r.error ? `<span class="err">${r.error}</span>` : (r.redirected ? 'redirect' : 'ok')}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Taskmaster Lighthouse report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { font-size: 1.5rem; }
    .meta { color: #444; font-size: 0.9rem; margin-bottom: 1.5rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f5f5f5; }
    code { font-size: 0.8rem; color: #555; }
    .good { color: #0d7a0d; font-weight: 600; }
    .warn { color: #9a6b00; font-weight: 600; }
    .bad { color: #b00020; font-weight: 600; }
    .na { color: #888; }
    .err { color: #b00020; font-size: 0.85rem; }
    tfoot td { font-weight: 600; background: #fafafa; }
  </style>
</head>
<body>
  <h1>Lighthouse — project summary</h1>
  <p class="meta">
    Base URL: <strong>${meta.baseUrl}</strong><br>
    Generated: ${meta.generatedAt}<br>
    Routes audited: ${rows.length} · Auth: ${meta.auth}<br>
    Per-page HTML in <code>pages/</code> · <a href="./performance-details.html">Slowdown breakdown</a> · <a href="./PERFORMANCE_REPORT.md">Markdown report</a>
  </p>
  <table>
    <thead>
      <tr>${th('Page')}${th('Perf')}${th('A11y')}${th('Best practices')}${th('SEO')}${th('Status')}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td>Average</td>
        <td>${avg('performance')}</td>
        <td>${avg('accessibility')}</td>
        <td>${avg('best-practices')}</td>
        <td>${avg('seo')}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

function headersForRoute(routePath, cookieHeader) {
  if (!cookieHeader || PUBLIC_ROUTE_PATHS.has(routePath)) return undefined;
  return { Cookie: cookieHeader };
}

async function runOne(url, chrome, extraHeaders) {
  const options = {
    logLevel: 'error',
    output: ['html', 'json'],
    onlyCategories: CATEGORIES,
    port: chrome.port,
    extraHeaders,
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 },
    maxWaitForFcp: 120000,
    maxWaitForLoad: 120000,
    settings: {
      throttlingMethod: process.env.LH_NO_THROTTLE === '1' ? 'provided' : 'simulate',
      skipAudits: [],
    },
  };

  const runnerResult = await lighthouse(url, options);
  return runnerResult;
}

async function main() {
  await loadLocalLhEnv();

  if (prodMode && /:5173\b/.test(BASE_URL)) {
    console.warn(
      'Warning: --prod set but LH_BASE_URL looks like Vite dev (:5173). ' +
        'Use production preview: npm run build && npm run preview, then LH_BASE_URL=http://localhost:4173'
    );
  } else if (!prodMode && /:5173\b/.test(BASE_URL)) {
    console.warn(
      'Tip: Dev server scores run lower than production. For accurate perf: ' +
        'npm run build && npm run preview, then LH_BASE_URL=http://localhost:4173 npm run lighthouse -- --prod'
    );
  }

  let routes = resolveRoutes({ publicOnly, protectedOnly, extraPaths });
  if (routeFilter) {
    routes = routes.filter((r) => r.path === routeFilter || r.path.startsWith(routeFilter));
    if (!routes.length) {
      console.error(`No route matched: ${routeFilter}`);
      process.exit(1);
    }
  }

  const needsAuth = routes.some((r) => !PUBLIC_ROUTE_PATHS.has(r.path));
  let cookieHeader = null;
  let authLabel = 'none';

  if (needsAuth && !publicOnly) {
    try {
      cookieHeader = await loginCookie();
      if (!cookieHeader) {
        console.error('Auth required but no session cookie. Set LH_EMAIL/LH_PASSWORD or LH_COOKIE.');
        process.exit(1);
      }
      authLabel = process.env.LH_COOKIE ? 'LH_COOKIE' : 'LH_EMAIL login';
    } catch (err) {
      console.error(`Auth failed: ${err.message}`);
      console.error('Protected routes need a valid session. Wait for rate limit reset or set LH_COOKIE.');
      process.exit(1);
    }
  }

  const up = await checkServer(BASE_URL);
  if (!up) {
    const hint = /:4173\b/.test(BASE_URL)
      ? 'npm run build && npm run preview'
      : 'cd client && npm run dev';
    console.error(`Cannot reach ${BASE_URL}. Start the app: ${hint}`);
    process.exit(1);
  }

  await fs.mkdir(path.join(OUTPUT_DIR, 'pages'), { recursive: true });

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });

  const rows = [];
  const total = routes.length;

  try {
    for (let i = 0; i < routes.length; i++) {
      const { path: routePath, name } = routes[i];
      const url = `${BASE_URL}${routePath}`;
      const slug = slugify(routePath);
      console.log(`[${i + 1}/${total}] ${name} (${routePath})`);

      try {
        const { lhr, report } = await runOne(url, chrome, headersForRoute(routePath, cookieHeader));
        const finalUrl = lhr.finalUrl || url;
        const redirected = finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '')
          && finalUrl.includes('/login');

        const scores = {
          performance: scoreFromLhr(lhr, 'performance'),
          accessibility: scoreFromLhr(lhr, 'accessibility'),
          'best-practices': scoreFromLhr(lhr, 'best-practices'),
          seo: scoreFromLhr(lhr, 'seo'),
        };

        const htmlPath = path.join(OUTPUT_DIR, 'pages', `${slug}.report.html`);
        const jsonPath = path.join(OUTPUT_DIR, 'pages', `${slug}.report.json`);

        const reports = Array.isArray(report) ? report : [report];
        await fs.writeFile(htmlPath, reports[0], 'utf8');
        if (reports[1]) {
          await fs.writeFile(jsonPath, reports[1], 'utf8');
        } else {
          await fs.writeFile(jsonPath, JSON.stringify(lhr, null, 2), 'utf8');
        }

        const insights = extractPageInsights(lhr);
        rows.push({
          path: routePath,
          name,
          slug,
          scores,
          redirected,
          error: null,
          insights,
        });
        console.log(
          `  perf ${scores.performance} · a11y ${scores.accessibility} · bp ${scores['best-practices']} · seo ${scores.seo}${redirected ? ' (redirected)' : ''}`
        );
      } catch (err) {
        rows.push({
          path: routePath,
          name,
          scores: {},
          redirected: false,
          error: err.message,
        });
        console.error(`  failed: ${err.message}`);
      }
    }
  } finally {
    await chrome.kill();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: authLabel,
    routes: rows,
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  const html = buildSummaryHtml(rows, {
    baseUrl: BASE_URL,
    generatedAt: summary.generatedAt,
    auth: authLabel,
  });
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8');

  const reportMeta = {
    baseUrl: BASE_URL,
    generatedAt: summary.generatedAt,
    auth: authLabel,
  };
  const md = buildPerformanceMarkdown(rows, reportMeta);
  await fs.writeFile(path.join(OUTPUT_DIR, 'PERFORMANCE_REPORT.md'), md, 'utf8');
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'performance-details.json'),
    JSON.stringify({ ...summary, routes: rows }, null, 2),
    'utf8'
  );
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'performance-details.html'),
    buildDetailsHtml(rows, reportMeta),
    'utf8'
  );

  console.log(`\nDone. Open ${path.join(OUTPUT_DIR, 'index.html')}`);
  console.log(`Detail report: ${path.join(OUTPUT_DIR, 'PERFORMANCE_REPORT.md')}`);

  if (minA11y > 0) {
    const failures = rows.filter(
      (r) => !r.error && (r.scores?.accessibility ?? 0) < minA11y
    );
    if (failures.length) {
      console.error(`\nAccessibility gate failed (min ${minA11y}):`);
      for (const f of failures) {
        console.error(`  ${f.path}: ${f.scores?.accessibility ?? 'n/a'}`);
      }
      process.exit(1);
    }
    console.log(`\nAccessibility gate passed (min ${minA11y}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
