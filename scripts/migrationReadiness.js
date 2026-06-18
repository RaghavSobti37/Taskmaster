#!/usr/bin/env node
/**
 * Postgres migration structure readiness gate (no production writes).
 * Usage: npm run migration:readiness
 *
 * Exit 0 = structure ready for preview/cutover ETL + strangler deploy.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const {
  ALL_ETL_KEYS,
  DEFERRED_ENTITIES,
  REQUIRED_FOR_CUTOVER,
} = require('../shared/etlCoverage');

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

const errors = [];
const warnings = [];

const pushError = (msg) => {
  errors.push(msg);
  fail(msg);
};
const pushWarn = (msg) => {
  warnings.push(msg);
  warn(msg);
};

const run = (label, cmd, opts = {}) => {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', env: { ...process.env, HUSKY: '0' }, ...opts });
    ok(label);
    return true;
  } catch (e) {
    pushError(`${label} failed`);
    const out = String(e.stdout || e.stderr || '').trim();
    if (out) console.log(out.slice(-2500));
    return false;
  }
};

const readFile = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
};

const checkEtlCoverageInSource = () => {
  const etlSource = readFile('nestjs-server/scripts/etl/mongo-to-postgres.ts');
  const missing = ALL_ETL_KEYS.filter((key) => !etlSource.includes(`key: '${key}'`));
  if (missing.length) {
    pushError(`ETL missing collection keys: ${missing.join(', ')}`);
    return;
  }
  ok(`ETL covers ${ALL_ETL_KEYS.length} collection keys`);
  if (DEFERRED_ENTITIES.length) {
    pushWarn(
      `${DEFERRED_ENTITIES.length} Supabase entities deferred (phase 2+): ${DEFERRED_ENTITIES.slice(0, 8).join(', ')}${DEFERRED_ENTITIES.length > 8 ? '…' : ''}`,
    );
  }
  ok(`${REQUIRED_FOR_CUTOVER.length} entities required for initial cutover`);
};

const checkInfraFiles = () => {
  const renderYaml = readFile('render.yaml');
  if (!renderYaml.includes('coreknot-nest-staging')) {
    pushError('render.yaml missing coreknot-nest-staging NestJS service');
  } else {
    ok('render.yaml defines coreknot-nest-staging');
  }

  const vercelGen = readFile('client/scripts/generateVercelConfig.cjs');
  if (!vercelGen.includes('NEST_API_PROXY_URL')) {
    pushError('generateVercelConfig.cjs missing NEST_API_PROXY_URL strangler support');
  } else {
    ok('Vercel config generator supports Nest strangler rewrites');
  }

  const previewEtl = readFile('nestjs-server/scripts/run-preview-etl.js');
  if (!previewEtl.includes('db:push')) {
    pushError('run-preview-etl.js must apply Prisma schema (db:push) before ETL');
  } else {
    ok('Preview ETL applies main Prisma schema before tiers');
  }

  const syncEnv = readFile('scripts/syncLocalMigrationEnv.js');
  if (syncEnv.includes("VITE_NEST_TASKS', 'true'")) {
    pushWarn('VITE_NEST_TASKS=true — tasks list still on Express; Nest tasks pilot is read-only');
  } else {
    ok('Local strangler: tasks stay on Express until Nest CRUD ships');
  }
};

const checkNestBuild = () => {
  run('Prisma validate', 'npm run prisma:validate --workspace=nestjs-server');
  run('NestJS production build', 'npm run build --workspace=nestjs-server');
  run('NestJS e2e tests', 'npm run test:e2e --workspace=nestjs-server');
};

const checkLocalOptional = async () => {
  const nestUrl = process.env.LOCAL_NEST_URL || 'http://127.0.0.1:5001';
  try {
    const res = await fetch(`${nestUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      run('local:verify (Nest running)', 'node server/scripts/verifyLocalMigration.js');
    } else {
      pushWarn('Nest not running — skip local:verify (start with npm run dev:nest)');
    }
  } catch {
    pushWarn('Nest not running — skip local:verify (start with npm run dev:nest)');
  }
};

const main = async () => {
  console.log('\nCoreKnot migration structure readiness\n');

  checkEtlCoverageInSource();
  checkInfraFiles();

  if (!fs.existsSync(path.join(ROOT, 'nestjs-server/prisma/schema.prisma'))) {
    pushError('Missing nestjs-server/prisma/schema.prisma');
  } else {
    ok('Main Prisma schema present');
  }

  checkNestBuild();
  await checkLocalOptional();

  console.log('');
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  if (errors.length) {
    console.log(`Blocking (${errors.length}):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('\nFix blockers, then: npm run migration:readiness\n');
    process.exit(1);
  }

  console.log('✓ Migration structure ready for preview ETL + strangler deploy.\n');
  console.log('Next (no prod writes until you approve):');
  console.log('  1. npm run preview:etl -- --dry-run');
  console.log('  2. Deploy coreknot-nest-staging on Render with preview DATABASE_URL');
  console.log('  3. Set NEST_API_PROXY_URL on Vercel Preview → /api/attendance strangler');
  console.log('  4. npm run preview:e2e-smoke\n');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
