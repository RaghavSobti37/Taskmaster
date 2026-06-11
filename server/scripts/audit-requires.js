#!/usr/bin/env node
/**
 * Static audit: validate relative require() paths resolve to existing files.
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  'domains',
  'models',
  'controllers',
  'routes',
  'services',
  'workers',
  'utils',
  'middleware',
  'app',
  'jobs',
  'repositories',
  'infrastructure',
];

const REQUIRE_RE = /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;

function resolveRequire(fromFile, reqPath) {
  const dir = path.dirname(fromFile);
  let resolved = path.resolve(dir, reqPath);

  const extensions = ['', '.js', '.json', '/index.js'];
  for (const ext of extensions) {
    const candidate = ext ? (ext.startsWith('/') ? resolved + ext : resolved + ext) : resolved;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { ok: true, resolved: candidate };
    }
  }
  // directory with index.js
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const idx = path.join(resolved, 'index.js');
    if (fs.existsSync(idx)) return { ok: true, resolved: idx };
  }

  return { ok: false, resolved };
}

function scanDir(relDir) {
  const absDir = path.join(SERVER_ROOT, relDir);
  if (!fs.existsSync(absDir)) return [];

  const broken = [];
  const files = [];

  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(full);
      } else if (ent.name.endsWith('.js')) {
        files.push(full);
      }
    }
  }
  walk(absDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let m;
    REQUIRE_RE.lastIndex = 0;
    while ((m = REQUIRE_RE.exec(content)) !== null) {
      const reqPath = m[1];
      const result = resolveRequire(file, reqPath);
      if (!result.ok) {
        broken.push({
          file: path.relative(SERVER_ROOT, file).replace(/\\/g, '/'),
          reqPath,
          line: content.slice(0, m.index).split('\n').length,
        });
      }
    }
  }
  return broken;
}

const allBroken = [];
for (const dir of SCAN_DIRS) {
  const broken = scanDir(dir);
  allBroken.push(...broken);
}

if (allBroken.length === 0) {
  console.log('OK: no broken relative require paths found.');
  process.exit(0);
}

console.log(`BROKEN: ${allBroken.length} path(s)\n`);
for (const b of allBroken) {
  console.log(`  ${b.file}:${b.line}  ->  ${b.reqPath}`);
}
process.exit(1);
