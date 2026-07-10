#!/usr/bin/env node
/**
 * Scan tracked files for live secrets not caught by exposure audit patterns.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PATTERNS = [
  { id: 'stripe-live', re: /sk_live_[A-Za-z0-9]{20,}/g },
  { id: 'openai-key', re: /sk-[A-Za-z0-9]{20,}/g },
  { id: 'mongodb-uri', re: /mongodb\+srv:\/\/[^:\s]+:[^@\s]+@/gi },
];

const SKIP_PREFIXES = ['docs/', '.cursor/', 'memory/', 'node_modules/'];
const SKIP_FILES = new Set([
  'server/.env.example',
  'server/.env.render.example',
  'README.md',
  'replacements.txt',
]);

const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((rel) => {
    if (SKIP_FILES.has(rel)) return false;
    if (SKIP_PREFIXES.some((p) => rel.startsWith(p))) return false;
    if (rel.endsWith('.md')) return false;
    if (rel.includes('/tests/') || rel.includes('.test.')) return false;
    return !rel.includes('node_modules/');
  })
  .filter((rel) => /^(client\/src|server\/|nestjs-server\/src|scripts\/)/.test(rel));

const violations = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, 'utf8');
  for (const { id, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(content)) violations.push({ rel, id });
  }
}

if (violations.length) {
  console.error('\naudit:secrets FAILED\n');
  violations.forEach((v) => console.error(`  [${v.id}] ${v.rel}`));
  process.exit(1);
}

console.log('audit:secrets passed');
process.exit(0);
