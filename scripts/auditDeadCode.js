#!/usr/bin/env node
/**
 * Orphan scan for utility modules (not pages/components/routes/models).
 * Scans client utils/lib/hooks and server/utils only.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Directories whose leaf modules should have inbound imports somewhere in app code. */
const SCAN_DIRS = [
  path.join(ROOT, 'client', 'src', 'utils'),
  path.join(ROOT, 'client', 'src', 'lib'),
  path.join(ROOT, 'client', 'src', 'hooks'),
  path.join(ROOT, 'server', 'utils'),
];

/** Full codebase used as import reference corpus. */
const CORPUS_DIRS = [
  path.join(ROOT, 'client', 'src'),
  path.join(ROOT, 'server'),
  path.join(ROOT, 'shared'),
  path.join(ROOT, 'e2e'),
];

const SKIP_DIR = new Set(['node_modules', 'coverage', '__mocks__']);
const SKIP_FILE = /\.(test|spec)\.[jt]sx?$/;

function walk(dir, out = [], { skipDirs = SKIP_DIR } = {}) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) {
      if (skipDirs.has(name)) continue;
      walk(abs, out, { skipDirs });
    } else if (/\.(js|jsx|cjs|mjs)$/.test(name) && !SKIP_FILE.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function readCorpus() {
  const files = CORPUS_DIRS.flatMap((d) =>
    walk(d, [], { skipDirs: new Set([...SKIP_DIR, 'tests']) })
  );
  return files
    .map((f) => {
      try {
        return fs.readFileSync(f, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
}

function isReferenced(abs, corpus) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const noExt = rel.replace(/\.(jsx?|cjs|mjs)$/, '');
  const base = path.basename(noExt);

  const needles = [
    noExt,
    `./${base}`,
    `/${base}'`,
    `/${base}"`,
    `'${base}'`,
    `"${base}"`,
  ];

  return needles.some((needle) => corpus.includes(needle));
}

const corpus = readCorpus();
const orphans = [];

for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = walk(dir).filter((abs) => {
    const relFromHooks = path.relative(path.join(ROOT, 'client', 'src', 'hooks'), abs);
    if (relFromHooks.startsWith('queries')) return false;
    if (path.basename(abs) === 'index.js') return false;
    return true;
  });

  for (const abs of files) {
    if (!isReferenced(abs, corpus)) {
      orphans.push(path.relative(ROOT, abs).replace(/\\/g, '/'));
    }
  }
}

if (orphans.length) {
  console.error('Dead code audit failed — orphan utility modules:');
  orphans.sort().forEach((f) => console.error(`  - ${f}`));
  console.error(`\n${orphans.length} orphan file(s). Delete or add imports, then re-run.`);
  process.exit(1);
}

console.log('Dead code audit passed (client utils/lib/hooks + server/utils).');
