#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..');

function resolveRequire(fromFile, reqPath) {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, reqPath);
  const extensions = ['', '.js', '.json', '/index.js'];
  for (const ext of extensions) {
    const candidate = ext ? resolved + ext : resolved;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const idx = path.join(resolved, 'index.js');
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function findShims(dir) {
  const shims = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(full);
      } else if (ent.name.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8').trim();
        const m = content.match(/^module\.exports\s*=\s*require\(['"](\.\.?\/[^'"]+)['"]\);?$/);
        if (m) {
          shims.push({
            file: path.relative(SERVER_ROOT, full).replace(/\\/g, '/'),
            target: m[1],
          });
        }
      }
    }
  }
  walk(path.join(SERVER_ROOT, dir));
  return shims;
}

// 1. Validate shims
const brokenShims = [];
for (const dir of ['models', 'controllers', 'routes', 'services', 'utils']) {
  for (const s of findShims(dir)) {
    const from = path.join(SERVER_ROOT, s.file);
    if (!resolveRequire(from, s.target)) {
      brokenShims.push(s);
    }
  }
}

// 2. Redundant domain self-paths (domains/foo requiring ../domains/bar)
const redundant = [];
const REQUIRE_RE = /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
function walkDomains(d, rel = 'domains') {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, ent.name);
    const relPath = `${rel}/${ent.name}`;
    if (ent.isDirectory()) walkDomains(full, relPath);
    else if (ent.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      let m;
      REQUIRE_RE.lastIndex = 0;
      while ((m = REQUIRE_RE.exec(content)) !== null) {
        if (m[1].includes('/domains/') || m[1].includes('\\domains\\')) {
          redundant.push({ file: relPath, reqPath: m[1], line: content.slice(0, m.index).split('\n').length });
        }
      }
    }
  }
}
walkDomains(path.join(SERVER_ROOT, 'domains'));

// 3. Runtime load all domain index-like entry points
const entryPoints = [];
function collectEntries(d, rel = 'domains') {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, ent.name);
    const relPath = `${rel}/${ent.name}`;
    if (ent.isDirectory()) collectEntries(full, relPath);
    else if (
      ent.name.endsWith('Routes.js') ||
      ent.name === 'routes.js' ||
      ent.name.endsWith('Facade.js') ||
      ent.name.endsWith('Router.js')
    ) {
      entryPoints.push('./' + relPath.replace(/\\/g, '/').replace(/\.js$/, ''));
    }
  }
}
collectEntries(path.join(SERVER_ROOT, 'domains'));

const loadFailures = [];
for (const ep of [...new Set(entryPoints)]) {
  try {
    require(path.join(SERVER_ROOT, ep));
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      loadFailures.push({ ep, err: e.message.split('\n')[0] });
    }
  }
}

console.log('=== SHIM AUDIT ===');
if (brokenShims.length) {
  console.log(`BROKEN SHIMS: ${brokenShims.length}`);
  brokenShims.forEach((b) => console.log(`  ${b.file} -> ${b.target}`));
} else {
  console.log('All shims resolve.');
}

console.log('\n=== REDUNDANT DOMAIN PATHS ===');
if (redundant.length) {
  redundant.forEach((r) => console.log(`  ${r.file}:${r.line} -> ${r.reqPath}`));
} else {
  console.log('None found.');
}

console.log('\n=== RUNTIME LOAD (MODULE_NOT_FOUND only) ===');
if (loadFailures.length) {
  loadFailures.forEach((f) => console.log(`  FAIL ${f.ep}: ${f.err}`));
} else {
  console.log('All entry points load (or failed for non-path reasons).');
}

process.exit(brokenShims.length || loadFailures.length ? 1 : 0);
