#!/usr/bin/env node
/**
 * Auth Vercel build must stay lean — no PWA SW and no dashboard route chunks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('verify-auth-build: missing dist/assets — run vite build --mode auth first');
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const forbiddenChunks = jsFiles.filter((f) =>
  /AdminUsers|ArtistReleases|OrgAccounts|Dashboard|AdminCRM|ArtistFinance/i.test(f),
);

if (fs.existsSync(path.join(distDir, 'sw.js'))) {
  console.error('verify-auth-build: sw.js must not ship on auth host');
  process.exit(1);
}

if (forbiddenChunks.length > 0) {
  console.error('verify-auth-build: dashboard chunks in auth bundle:', forbiddenChunks.slice(0, 10));
  process.exit(1);
}

const maxJsChunks = Number(process.env.AUTH_BUILD_MAX_JS_CHUNKS || 60);
if (jsFiles.length > maxJsChunks) {
  console.error(`verify-auth-build: too many JS chunks (${jsFiles.length} > ${maxJsChunks})`);
  process.exit(1);
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('verify-auth-build: index.html missing after auth finalize');
  process.exit(1);
}

console.log(`verify-auth-build: OK — ${jsFiles.length} JS chunks, no sw.js, no dashboard routes`);
