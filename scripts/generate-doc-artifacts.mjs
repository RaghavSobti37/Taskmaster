#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const generatedAt = new Date().toISOString().slice(0, 10);

const inventoryPath = path.join(root, 'docs/.generated/page-inventory.json');
const pagePermissionsPath = path.join(root, 'client/src/utils/pagePermissions.js');
const appPath = path.join(root, 'client/src/App.jsx');
const navAccessPath = path.join(root, 'client/src/utils/navPageAccess.js');
const navbarConfigPath = path.join(root, 'client/src/utils/navbarConfig.js');
const sharedDir = path.join(root, 'shared');

const {
  ORG_FEATURE_CATALOG,
  ORG_FEATURE_KEYS,
  defaultFeatureUnlocks,
} = require('../shared/orgFeatures.cjs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(relPath, payload) {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

function parseArrayConst(src, constName) {
  const match = src.match(new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) return [];
  return match[1]
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/^['"`]|['"`]$/g, ''))
    .filter((token) => token && !token.startsWith('...'));
}

function parsePresetPages(src) {
  const blockMatch = src.match(/export\s+const\s+PRESET_PAGES\s*=\s*\{([\s\S]*?)\n\};/);
  if (!blockMatch) return {};
  const block = blockMatch[1];
  const base = parseArrayConst(src, 'BASE_PAGE_KEYS');
  const opsExtra = parseArrayConst(src, 'OPS_EXTRA_PAGES');
  const creativeExtra = parseArrayConst(src, 'CREATIVE_EXTRA_PAGES');
  const out = {};
  const lineRe = /^\s*(['"\w-]+)\s*:\s*\[([^\]]*)\]/gm;
  let line = lineRe.exec(block);
  while (line) {
    const preset = line[1].replace(/^['"]|['"]$/g, '');
    const raw = line[2];
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    const expanded = [];
    for (const token of tokens) {
      if (token === '...BASE_PAGE_KEYS') expanded.push(...base);
      else if (token === '...OPS_EXTRA_PAGES') expanded.push(...opsExtra);
      else if (token === '...CREATIVE_EXTRA_PAGES') expanded.push(...creativeExtra);
      else if (token === '...ALL_PAGE_KEYS') expanded.push('__ALL_PAGE_KEYS__');
      else expanded.push(token.replace(/^['"`]|['"`]$/g, ''));
    }
    out[preset] = [...new Set(expanded)];
    line = lineRe.exec(block);
  }
  return out;
}

function parseObjectMap(src, objectName) {
  const match = src.match(new RegExp(`export\\s+const\\s+${objectName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!match) return {};
  const out = {};
  const entryRe = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let entry = entryRe.exec(match[1]);
  while (entry) {
    out[entry[1]] = entry[2];
    entry = entryRe.exec(match[1]);
  }
  return out;
}

function parseHubTabs(src) {
  const hubs = {};
  const hubRe = /'([^']+)':\s*\{[\s\S]*?tabs:\s*\[([\s\S]*?)\]\s*,[\s\S]*?\n\s*\},/g;
  let hub = hubRe.exec(src);
  while (hub) {
    const hubPath = hub[1];
    const tabs = [];
    const tabRe = /\{\s*id:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'\s*,\s*key:\s*'([^']+)'\s*\}/g;
    let tab = tabRe.exec(hub[2]);
    while (tab) {
      tabs.push({ id: tab[1], label: tab[2], key: tab[3] });
      tab = tabRe.exec(hub[2]);
    }
    if (tabs.length) hubs[hubPath] = tabs;
    hub = hubRe.exec(src);
  }
  return hubs;
}

function buildRouteAccessMatrix() {
  const appSrc = read(appPath);
  const navSrc = read(navAccessPath);
  const navMap = parseObjectMap(navSrc, 'NAV_PATH_ACCESS');
  const featureMap = parseObjectMap(navSrc, 'FEATURE_UNLOCK_BY_PATH');
  const hubTabs = parseHubTabs(read(navbarConfigPath));

  const redirects = [];
  const redirectRe = /<Route\s+path="([^"]+)"\s+element={<(?:OrgNavigate|Navigate)\s+to="([^"]+)"\s+replace\s*\/>}[\s\S]*?\/>/g;
  let r = redirectRe.exec(appSrc);
  while (r) {
    redirects.push({ from: r[1], to: r[2] });
    r = redirectRe.exec(appSrc);
  }

  const redirectMap = Object.fromEntries(redirects.map((x) => [x.from, x.to]));
  const rows = Object.entries(navMap)
    .map(([pathKey, pageKey]) => ({
      path: pathKey,
      pageKey,
      tab: null,
      legacyRedirectTo: redirectMap[pathKey] || null,
      featureKey: featureMap[pathKey] || null,
    }));

  for (const [hubPath, tabs] of Object.entries(hubTabs)) {
    for (const tab of tabs) {
      rows.push({
        path: `${hubPath}?tab=${tab.id}`,
        pageKey: tab.key,
        tab: tab.id,
        legacyRedirectTo: null,
        featureKey: featureMap[hubPath] || null,
      });
    }
  }

  return {
    generatedAt,
    redirects,
    rows: rows.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function buildHookEndpointMap() {
  const inventory = JSON.parse(read(inventoryPath));
  const hookSet = new Set();
  const builtin = new Set([
    'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect',
    'useNavigate', 'useLocation', 'useParams', 'useQuery', 'useMutation', 'useQueryClient',
  ]);
  for (const page of inventory) {
    for (const hook of page.hooks || []) {
      if (!builtin.has(hook)) hookSet.add(hook);
    }
  }

  const allClientFiles = walk(path.join(root, 'client/src'))
    .filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
  const apiRe = /['"`](\/api\/[^'"`\s]+)['"`]/g;
  const out = {};
  for (const hookName of [...hookSet].sort()) {
    const usedIn = [];
    for (const abs of allClientFiles) {
      const src = read(abs);
      if (new RegExp(`\\b${hookName}\\b`).test(src)) {
        const endpoints = [...new Set([...src.matchAll(apiRe)].map((m) => m[1]))];
        if (endpoints.length || new RegExp(`\\b(?:function|const)\\s+${hookName}\\b`).test(src)) {
          usedIn.push({
            file: path.relative(root, abs).replace(/\\/g, '/'),
            endpoints,
            network: endpoints.length > 0,
          });
        }
      }
    }
    if (usedIn.length) {
      usedIn.sort((a, b) => a.file.localeCompare(b.file));
      for (const entry of usedIn) {
        entry.endpoints.sort();
      }
      out[hookName] = {
        files: usedIn,
        endpoints: [...new Set(usedIn.flatMap((f) => f.endpoints))].sort(),
        network: usedIn.some((f) => f.network),
      };
    }
  }
  return {
    generatedAt,
    hooks: out,
  };
}

function buildPresetPageMatrix() {
  const src = read(pagePermissionsPath);
  const presets = parsePresetPages(src);
  return {
    generatedAt,
    presets,
  };
}

function buildSharedRulesInventory() {
  const files = fs.readdirSync(sharedDir)
    .filter((name) => /\.(js|cjs|mjs)$/.test(name))
    .sort();
  const rows = [];
  for (const fileName of files) {
    const rel = `shared/${fileName}`;
    const src = read(path.join(sharedDir, fileName));
    if (!/(rule|metrics|stream|finance|analytics|permission|review|attendance|gamification)/i.test(fileName)) continue;
    const exports = [
      ...[...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]),
      ...[...src.matchAll(/module\.exports\s*=\s*\{([\s\S]*?)\}/g)].flatMap((m) => [...m[1].matchAll(/([A-Za-z0-9_]+)\s*[:,]/g)].map((x) => x[1])),
    ];
    rows.push({
      file: rel,
      exports: [...new Set(exports)].sort(),
    });
  }
  return {
    generatedAt,
    modules: rows,
  };
}

function buildFeatureUnlockMatrix() {
  const defaults = defaultFeatureUnlocks();
  const rows = ORG_FEATURE_KEYS.map((key) => ({
    key,
    label: ORG_FEATURE_CATALOG[key]?.label || key,
    defaultOnCreate: Boolean(defaults[key]),
    gatedPaths: ORG_FEATURE_CATALOG[key]?.gatedPaths || [],
  }));
  return {
    generatedAt,
    rows,
  };
}

export function generateDocArtifacts() {
  const routeAccess = buildRouteAccessMatrix();
  const hookEndpoint = buildHookEndpointMap();
  const presetPage = buildPresetPageMatrix();
  const sharedRules = buildSharedRulesInventory();
  const featureUnlocks = buildFeatureUnlockMatrix();

  writeJson('docs/.generated/route-access-matrix.json', routeAccess);
  writeJson('docs/.generated/hook-endpoint-map.json', hookEndpoint);
  writeJson('docs/.generated/preset-page-matrix.json', presetPage);
  writeJson('docs/.generated/shared-rules-inventory.json', sharedRules);
  writeJson('docs/.generated/feature-unlock-matrix.json', featureUnlocks);

  return { routeAccess, hookEndpoint, presetPage, sharedRules, featureUnlocks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateDocArtifacts();
  console.log('Generated doc artifacts in docs/.generated');
}
