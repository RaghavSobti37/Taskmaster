const path = require('path');
const fs = require('fs').promises;
const { pathToFileURL } = require('url');
const { getAllLighthouseRoutes, PUBLIC_PATHS } = require('./lighthouseRoutes');
const { reportQaActivity } = require('./qaActivity');

const REPO_ROOT = path.join(__dirname, '../../..');
const CLIENT_ROOT = path.join(REPO_ROOT, 'client');

const PERF_PASS = 90;
const A11Y_PASS = 95;

function scoreFromLhr(lhr, categoryId) {
  const cat = lhr.categories?.[categoryId];
  if (!cat || cat.score == null) return null;
  return Math.round(cat.score * 100);
}

function parseUnusedKiB(lhr) {
  const audit = lhr.audits?.['unused-javascript'];
  if (!audit?.details?.overallSavingsBytes) return 0;
  return Math.round(audit.details.overallSavingsBytes / 1024);
}

function parseLcpMs(lhr) {
  const audit = lhr.audits?.['largest-contentful-paint'];
  return audit?.numericValue ? Math.round(audit.numericValue) : null;
}

function topOpportunity(lhr) {
  const audits = lhr.audits || {};
  const opps = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && a.score != null && a.score < 0.9)
    .sort((a, b) => (b.details?.overallSavingsBytes || 0) - (a.details?.overallSavingsBytes || 0));
  const top = opps[0];
  return top ? { id: top.id, title: top.title, displayValue: top.displayValue } : null;
}

function computeLoadScore(page) {
  const perf = page.performance ?? 50;
  const unused = page.unusedKiB ?? 0;
  const lcp = page.lcpMs ?? 3500;
  return (100 - perf) + unused / 5 + Math.max(0, lcp - 3000) / 40;
}

/** Relative tertiles: heaviest third = red, middle = yellow, lightest = green */
function assignPageWeights(pages) {
  const scored = pages.map((p) => ({ ...p, loadScore: computeLoadScore(p) }));
  scored.sort((a, b) => b.loadScore - a.loadScore);
  const n = scored.length;
  return scored.map((p, i) => {
    if (p.performance != null && p.performance < 50) {
      return { ...p, weight: 'heavy' };
    }
    const ratio = n <= 1 ? 0 : i / (n - 1);
    let weight = 'light';
    if (ratio <= 0.33) weight = 'heavy';
    else if (ratio <= 0.66) weight = 'medium';
    return { ...p, weight };
  });
}

async function loadLhEnv() {
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

function extractSetCookieHeader(res) {
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (cookies.length === 0) {
    const single = res.headers.get('set-cookie');
    if (single) cookies.push(single);
  }
  return cookies.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function qaAdminCookieHeader() {
  try {
    const jwt = require('jsonwebtoken');
    const { resolveTestUsers } = require('./qaApiClient');
    const { COOKIE_NAME } = require('../../utils/authCookie');
    const { adminUser } = await resolveTestUsers();
    if (!adminUser?._id) return null;
    const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'secret');
    return `${COOKIE_NAME}=${token}`;
  } catch {
    return null;
  }
}

async function loginCookie() {
  if (process.env.LH_COOKIE?.trim()) return process.env.LH_COOKIE.trim();
  const email = process.env.LH_EMAIL;
  const password = process.env.LH_PASSWORD;
  const apiUrl = (process.env.LH_API_URL || process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');

  if (email && password) {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const header = extractSetCookieHeader(res);
      if (header) return header;
    }
  }

  const qaCookie = await qaAdminCookieHeader();
  if (qaCookie) return qaCookie;

  if (email && password) {
    throw new Error('Lighthouse login failed (401) — check LH_EMAIL/LH_PASSWORD or seed admin in DB');
  }
  return null;
}

async function loadLighthouseModules() {
  const lighthouseMod = path.join(CLIENT_ROOT, 'node_modules/lighthouse/core/index.js');
  const chromeMod = path.join(CLIENT_ROOT, 'node_modules/chrome-launcher/dist/index.js');
  try {
    await fs.access(lighthouseMod);
    await fs.access(chromeMod);
  } catch {
    throw new Error(
      'Lighthouse not installed. Run: cd client && npm install (needs lighthouse + chrome-launcher)'
    );
  }
  const lighthouse = (await import(pathToFileURL(lighthouseMod))).default;
  const chromeLauncher = await import(pathToFileURL(chromeMod));
  const launchChrome = chromeLauncher.launch || chromeLauncher.default?.launch;
  if (!launchChrome) throw new Error('chrome-launcher launch() not found');
  let extractPageInsights = null;
  try {
    const insightsUrl = pathToFileURL(path.join(CLIENT_ROOT, 'scripts/lighthouse-insights.mjs'));
    const insights = await import(insightsUrl);
    extractPageInsights = insights.extractPageInsights;
  } catch {
    /* insights optional */
  }
  return { lighthouse, launchChrome, extractPageInsights };
}

/** Preview URL for Lighthouse — production QA must not default to localhost. */
function resolveLhBaseUrl() {
  const explicit = (process.env.LH_BASE_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const isHostedRuntime =
    process.env.NODE_ENV === 'production'
    || process.env.RENDER === 'true'
    || Boolean(process.env.RENDER_SERVICE_ID);

  if (isHostedRuntime) {
    const front = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://tsccoreknot.com')
      .trim()
      .replace(/\/$/, '');
    if (front && !/localhost|127\.0\.0\.1/i.test(front)) return front;
  }

  return 'http://localhost:5173';
}

function resolveLighthouseRoutes(pathFilter) {
  const all = getAllLighthouseRoutes();
  if (!pathFilter?.length) return all;
  const wanted = new Set(pathFilter.map((p) => String(p).trim()).filter(Boolean));
  const picked = all.filter((r) => wanted.has(r.path));
  if (!picked.length) {
    throw new Error('No Lighthouse routes matched the selected pages');
  }
  return picked;
}

async function runFullLighthouseAudit(onPage, options = {}) {
  await loadLhEnv();
  const baseUrl = resolveLhBaseUrl();
  const routes = resolveLighthouseRoutes(options.paths);
  const needsAuth = routes.some((r) => !PUBLIC_PATHS.has(r.path));

  let cookieHeader = null;
  if (needsAuth) {
    cookieHeader = await loginCookie();
    if (!cookieHeader) {
      throw new Error('Lighthouse needs LH_EMAIL/LH_PASSWORD in client/.lighthouse.env for protected routes');
    }
  }

  try {
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status >= 500) throw new Error(`Cannot reach ${baseUrl}`);
  } catch (err) {
    const hint = /localhost|127\.0\.0\.1/i.test(baseUrl)
      ? 'Start preview: cd client && npm run build && npm run preview — or set LH_BASE_URL=http://localhost:5173 for dev'
      : `Set LH_BASE_URL to your live frontend (e.g. https://tsccoreknot.com) or verify FRONTEND_URL on this host`;
    throw new Error(`Cannot reach ${baseUrl}. ${hint}`);
  }

  const { lighthouse, launchChrome, extractPageInsights } = await loadLighthouseModules();
  const chrome = await launchChrome({ chromeFlags: ['--headless', '--no-sandbox'] });
  const pages = [];

  try {
    for (let i = 0; i < routes.length; i++) {
      const { path: routePath, name } = routes[i];
      const url = `${baseUrl}${routePath}`;
      if (onPage) await onPage({ index: i, total: routes.length, path: routePath, name });

      reportQaActivity({
        phase: 'running',
        kind: 'lighthouse',
        action: `Lighthouse audit ${i + 1}/${routes.length}`,
        target: routePath,
        url,
        message: name,
      });

      const extraHeaders =
        cookieHeader && !PUBLIC_PATHS.has(routePath) ? { Cookie: cookieHeader } : undefined;

      try {
        const runnerResult = await lighthouse(url, {
          logLevel: 'error',
          output: 'json',
          onlyCategories: ['performance', 'accessibility'],
          port: chrome.port,
          extraHeaders,
          formFactor: 'desktop',
          screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 },
        });
        const lhr = runnerResult.lhr;
        const insights = extractPageInsights ? extractPageInsights(lhr) : null;
        pages.push({
          path: routePath,
          name,
          performance: scoreFromLhr(lhr, 'performance'),
          accessibility: scoreFromLhr(lhr, 'accessibility'),
          unusedKiB: parseUnusedKiB(lhr),
          lcpMs: parseLcpMs(lhr),
          fcpDisplay: lhr.audits?.['first-contentful-paint']?.displayValue,
          lcpDisplay: lhr.audits?.['largest-contentful-paint']?.displayValue,
          topIssue: topOpportunity(lhr),
          insights,
          error: null,
        });
      } catch (err) {
        pages.push({
          path: routePath,
          name,
          performance: null,
          accessibility: null,
          error: err.message,
        });
      }
    }
  } finally {
    await chrome.kill();
  }

  const weighted = assignPageWeights(pages.filter((p) => !p.error));
  const errored = pages.filter((p) => p.error);
  const allPages = [...weighted, ...errored.map((p) => ({ ...p, weight: 'heavy' }))];

  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    pageCount: allPages.length,
    pages: allPages.sort((a, b) => computeLoadScore(b) - computeLoadScore(a)),
    summary: {
      heavy: allPages.filter((p) => p.weight === 'heavy').length,
      medium: allPages.filter((p) => p.weight === 'medium').length,
      light: allPages.filter((p) => p.weight === 'light').length,
    },
  };
}

function pageToTestCasePayload(page) {
  const perfOk = page.performance != null && page.performance >= PERF_PASS;
  const a11yOk = page.accessibility != null && page.accessibility >= A11Y_PASS;
  const passed = !page.error && perfOk && a11yOk;
  const checkStatus = page.error ? 'fail' : !passed ? 'warn' : 'pass';

  return {
    name: `[Lighthouse] ${page.name}`,
    status: checkStatus === 'fail' ? 'failed' : checkStatus === 'warn' ? 'warn' : 'passed',
    checkStatus,
    category: 'lighthouse',
    checklistId: `lh-${page.path.replace(/[/:]/g, '-')}`,
    severity: page.weight === 'heavy' ? 'high' : page.weight === 'medium' ? 'medium' : 'low',
    description: page.error
      ? page.error
      : `Perf ${page.performance} · A11y ${page.accessibility} · ${page.weight} load` +
        (page.topIssue?.title ? ` · ${page.topIssue.title}` : ''),
    error: page.error || (!passed ? `Below target (perf≥${PERF_PASS}, a11y≥${A11Y_PASS})` : null),
    result: {
      lighthouse: page,
    },
  };
}

function buildLighthouseBatchTestCase(qaService, pathFilter) {
  const routeCount = resolveLighthouseRoutes(pathFilter).length;
  const targetLabel =
    pathFilter?.length && pathFilter.length < getAllLighthouseRoutes().length
      ? `${routeCount} selected routes`
      : 'all routes';

  return {
    name: '[Lighthouse] Full site perf & accessibility audit',
    category: 'lighthouse',
    lighthouseBatch: true,
    severity: 'medium',
    qaMeta: {
      kind: 'lighthouse',
      action: `Chrome Lighthouse audit for ${targetLabel}`,
      target: targetLabel,
    },
    test: async () => {
      try {
      const report = await runFullLighthouseAudit(async ({ index, total, path: routePath, name }) => {
        await qaService.setLiveActivity({
          phase: 'running',
          kind: 'lighthouse',
          category: 'lighthouse',
          action: `Lighthouse ${index + 1}/${total}`,
          target: routePath,
          testName: `[Lighthouse] ${name}`,
          message: name,
        });
        const progress = Math.round((index / total) * 100);
        await qaService.updateProgress(progress, { name: `[Lighthouse] ${name}`, category: 'lighthouse' }, index, total);
      }, { paths: pathFilter });
      return {
        passed: true,
        checkStatus: 'pass',
        lighthouseReport: report,
        lighthousePages: report.pages,
        message: `Audited ${report.pageCount} routes (${report.summary.heavy} heavy · ${report.summary.medium} medium · ${report.summary.light} light)`,
        description: `Base URL ${report.baseUrl}`,
      };
      } catch (err) {
        const msg = err?.message || String(err);
        const skipOnHosted =
          (process.env.RENDER === 'true' || process.env.NODE_ENV === 'production')
          && /Cannot reach|Lighthouse not installed|chrome-launcher|ENOENT|spawn/i.test(msg);
        if (skipOnHosted) {
          return {
            passed: true,
            checkStatus: 'skip',
            message: `[SKIP] Lighthouse on API host: ${msg.slice(0, 180)}`,
            description: 'Run Lighthouse from CI or local with LH_BASE_URL; API container has no preview server',
            error: null,
          };
        }
        throw err;
      }
    },
  };
}

module.exports = {
  buildLighthouseBatchTestCase,
  runFullLighthouseAudit,
  resolveLhBaseUrl,
  resolveLighthouseRoutes,
  assignPageWeights,
  pageToTestCasePayload,
  PERF_PASS,
  A11Y_PASS,
  getAllLighthouseRoutes,
  PUBLIC_PATHS,
};
