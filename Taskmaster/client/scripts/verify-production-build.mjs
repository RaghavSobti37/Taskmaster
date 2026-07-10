#!/usr/bin/env node
/**
 * Fail CI if production bundle still contains unresolved import.meta.env (DEV leaks).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('verify-production-build: missing dist/assets — run vite build first');
  process.exit(1);
}

const leaks = [];
for (const name of fs.readdirSync(assetsDir)) {
  if (!name.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(assetsDir, name), 'utf8');
  if (content.includes('import.meta.env')) {
    leaks.push(name);
  }
}

if (leaks.length) {
  console.error(
    'verify-production-build: unresolved import.meta.env in production assets:',
    leaks.join(', '),
  );
  process.exit(1);
}

console.log('verify-production-build: ok');
