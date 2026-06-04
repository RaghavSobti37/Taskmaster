#!/usr/bin/env node
/**
 * Audit routes one-by-one; re-run any route with perf or a11y below MIN_SCORE until pass or MAX_ROUNDS.
 *
 * Usage:
 *   npm run build && npm run preview
 *   LH_BASE_URL=http://localhost:4173 node scripts/lighthouse-loop.mjs --prod
 *
 * Env: same as lighthouse-audit.mjs · MIN_SCORE (default 50) · MAX_ROUNDS (default 3)
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRoutes, PUBLIC_ROUTES } from './lighthouse-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, '..');
const MIN_SCORE = Number(process.env.MIN_SCORE || 50);
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS || 3);
const args = process.argv.slice(2);
const publicOnly = args.includes('--public-only');

function runAudit(routePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/lighthouse-audit.mjs', `--route=${routePath}`, ...args],
      {
        cwd: CLIENT_ROOT,
        stdio: 'inherit',
        env: process.env,
      }
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`audit failed: ${routePath}`))));
  });
}

async function readScores(routePath) {
  const slug = routePath === '/' ? 'home' : routePath.replace(/^\//, '').replace(/[/:]/g, '_');
  const jsonPath = path.join(CLIENT_ROOT, 'lighthouse-reports', 'pages', `${slug}.report.json`);
  const j = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  return {
    perf: j.categories?.performance?.score != null ? Math.round(j.categories.performance.score * 100) : null,
    a11y: j.categories?.accessibility?.score != null ? Math.round(j.categories.accessibility.score * 100) : null,
    error: j.runtimeError?.message || null,
  };
}

async function main() {
  const routes = resolveRoutes({ publicOnly, protectedOnly: false, extraPaths: [] });
  if (publicOnly) {
    routes.splice(0, routes.length, ...PUBLIC_ROUTES);
  }

  const failing = new Map(routes.map((r) => [r.path, r]));

  for (let round = 1; round <= MAX_ROUNDS && failing.size; round += 1) {
    console.log(`\n=== Round ${round}/${MAX_ROUNDS} (${failing.size} routes) ===`);
    for (const { path: routePath, name } of failing.values()) {
      console.log(`\n→ ${name} (${routePath})`);
      await runAudit(routePath);
      const scores = await readScores(routePath);
      const ok =
        scores.perf != null &&
        scores.a11y != null &&
        scores.perf >= MIN_SCORE &&
        scores.a11y >= MIN_SCORE;
      console.log(`  perf ${scores.perf ?? '—'} · a11y ${scores.a11y ?? '—'}${scores.error ? ` · ${scores.error}` : ''}`);
      if (ok) failing.delete(routePath);
    }
  }

  if (failing.size) {
    console.error('\nStill below threshold:');
    for (const { path: p, name } of failing.values()) console.error(`  - ${name} (${p})`);
    process.exit(1);
  }
  console.log(`\nAll routes ≥ ${MIN_SCORE} for performance and accessibility.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
