/**
 * Layer 2 — UI Discovery Engine
 * Auto-discover routes, pages, and UI elements; emit page manifests.
 */
const fs = require('fs').promises;
const path = require('path');
const { getAllLighthouseRoutes } = require('./lighthouseRoutes');

const CLIENT_ROOT = path.join(__dirname, '../../../client/src');
const PAGES_DIR = path.join(CLIENT_ROOT, 'pages');
const APP_ROUTER = path.join(CLIENT_ROOT, 'App.jsx');

const UI_PATTERNS = {
  buttons: /<Button\b|<button\b/gi,
  forms: /<form\b|<Form\b|useForm\(/gi,
  tables: /<table\b|DataTable|DailyLogsTable|Table\b/gi,
  filters: /filter|Filter|searchQuery|setFilter/gi,
  modals: /Modal\b|Dialog\b|isOpen|openModal/gi,
  drawers: /Drawer\b|Sheet\b|sidePanel/gi,
  tabs: /Tabs\b|Tab\b|activeTab|setTab/gi,
};

function countMatches(content, pattern) {
  const m = content.match(pattern);
  return m ? m.length : 0;
}

function extractRoutesFromApp(content) {
  const routes = [];
  const re = /<Route\s+path=["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const p = match[1];
    if (!routes.includes(p)) routes.push(p);
  }
  return routes;
}

function fileToRoutePath(filePath, routesFromApp) {
  const rel = path.relative(PAGES_DIR, filePath).replace(/\\/g, '/');
  const base = rel.replace(/\.(jsx|tsx|js)$/, '');
  const nameLower = path.basename(filePath).toLowerCase();

  const lh = getAllLighthouseRoutes().find((r) => {
    const seg = r.path.split('/').filter(Boolean).pop() || '';
    return nameLower.includes(seg.toLowerCase()) || base.toLowerCase().includes(seg.replace(/-/g, ''));
  });
  if (lh) return lh.path;

  for (const r of routesFromApp) {
    const seg = r.split('/').filter(Boolean).pop() || '';
    if (seg && nameLower.replace(/page\.(jsx|tsx)$/, '').includes(seg.toLowerCase())) return r;
  }

  if (base.startsWith('admin/')) return `/admin/${base.split('/').slice(1).join('/')}`;
  return `/${base.replace(/Page$/, '').replace(/\/index$/, '').toLowerCase()}`;
}

async function walkPages(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkPages(full, files);
    else if (/\.(jsx|tsx|js)$/.test(entry.name) && !entry.name.includes('.test.')) files.push(full);
  }
  return files;
}

async function discoverPageManifest(filePath, routesFromApp) {
  const content = await fs.readFile(filePath, 'utf8');
  const rel = path.relative(PAGES_DIR, filePath).replace(/\\/g, '/');
  const routePath = fileToRoutePath(filePath, routesFromApp);

  const elements = {};
  for (const [key, pattern] of Object.entries(UI_PATTERNS)) {
    const count = countMatches(content, pattern);
    if (count > 0) elements[key] = count;
  }

  const imports = (content.match(/from\s+['"][^'"]+['"]/g) || []).length;
  const hasDataFetch = /useQuery|useMutation|axios\.|fetch\(/i.test(content);

  return {
    pagePath: routePath,
    sourceFile: rel,
    component: path.basename(filePath, path.extname(filePath)),
    discoveredAt: new Date().toISOString(),
    uiElements: elements,
    meta: {
      imports,
      hasDataFetch,
      lineCount: content.split('\n').length,
    },
  };
}

let cachedManifests = null;

async function generateAllPageManifests() {
  if (cachedManifests) return cachedManifests;

  let appContent = '';
  try {
    appContent = await fs.readFile(APP_ROUTER, 'utf8');
  } catch {
    /* App.jsx missing */
  }
  const routesFromApp = extractRoutesFromApp(appContent);
  const pageFiles = await walkPages(PAGES_DIR);
  const manifests = [];

  for (const file of pageFiles) {
    try {
      manifests.push(await discoverPageManifest(file, routesFromApp));
    } catch {
      /* skip unreadable */
    }
  }

  const lhRoutes = getAllLighthouseRoutes();
  for (const r of lhRoutes) {
    if (!manifests.some((m) => m.pagePath === r.path)) {
      manifests.push({
        pagePath: r.path,
        sourceFile: null,
        component: r.name,
        discoveredAt: new Date().toISOString(),
        uiElements: {},
        meta: { routeOnly: true },
      });
    }
  }

  cachedManifests = manifests.sort((a, b) => a.pagePath.localeCompare(b.pagePath));
  return cachedManifests;
}

function clearManifestCache() {
  cachedManifests = null;
}

async function buildUiDiscoveryTestCases(reportDiscovery) {
  const manifests = await generateAllPageManifests();
  if (reportDiscovery) {
    await reportDiscovery(`UI discovery: ${manifests.length} page manifests`);
  }

  const summaryCase = {
    name: '[UI Discovery] Page manifest summary',
    category: 'ui-discovery',
    severity: 'low',
    checklistId: 'ui-discovery-summary',
    qaMeta: { kind: 'ui-discovery', action: 'Aggregate page manifests', layer: 2 },
    test: async () => {
      const withButtons = manifests.filter((m) => m.uiElements.buttons > 0).length;
      const withForms = manifests.filter((m) => m.uiElements.forms > 0).length;
      const withTables = manifests.filter((m) => m.uiElements.tables > 0).length;
      return {
        passed: true,
        checkStatus: 'pass',
        message: `${manifests.length} pages discovered`,
        description: `Routes: ${manifests.length} | buttons: ${withButtons} pages | forms: ${withForms} | tables: ${withTables}`,
        result: { pageCount: manifests.length, withButtons, withForms, withTables },
        pageManifests: manifests,
      };
    },
  };

  const spotChecks = manifests
    .filter((m) => Object.keys(m.uiElements).length > 0)
    .slice(0, 12)
    .map((manifest) => ({
      name: `[UI Discovery] ${manifest.pagePath}`,
      category: 'ui-discovery',
      severity: 'low',
      checklistId: `ui-disc-${manifest.pagePath.replace(/[^a-z0-9]+/gi, '-')}`,
      qaMeta: {
        kind: 'ui-discovery',
        action: 'Verify page manifest elements',
        target: manifest.pagePath,
        layer: 2,
      },
      test: async () => {
        const el = manifest.uiElements;
        const total = Object.values(el).reduce((s, n) => s + n, 0);
        if (total === 0 && !manifest.meta?.routeOnly) {
          return {
            passed: true,
            checkStatus: 'warn',
            description: `${manifest.pagePath}: no interactive elements detected`,
          };
        }
        return {
          passed: true,
          checkStatus: 'pass',
          description: `${manifest.pagePath}: ${Object.entries(el).map(([k, v]) => `${k}=${v}`).join(', ') || 'route-only'}`,
          result: manifest,
        };
      },
    }));

  return [summaryCase, ...spotChecks];
}

module.exports = {
  generateAllPageManifests,
  clearManifestCache,
  buildUiDiscoveryTestCases,
  extractRoutesFromApp,
  discoverPageManifest,
};
