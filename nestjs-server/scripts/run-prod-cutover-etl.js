#!/usr/bin/env node
/**
 * Maintenance-window ETL: prod Mongo → prod Supabase.
 * Run only after Vercel preview QA passes.
 *
 * Usage:
 *   node scripts/run-prod-cutover-etl.js --dry-run
 *   node scripts/run-prod-cutover-etl.js --yes
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const HOSTS_PATH = path.join(ROOT, '.cursor/production-hosts.local.json');
const SERVER_ENV = path.join(ROOT, 'server/.env');

function loadHosts() {
  if (!fs.existsSync(HOSTS_PATH)) {
    console.error('Missing .cursor/production-hosts.local.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
}

function loadMongoProdUri() {
  if (process.env.MONGODB_URI_PROD) return process.env.MONGODB_URI_PROD;
  if (!fs.existsSync(SERVER_ENV)) return null;
  const line = fs
    .readFileSync(SERVER_ENV, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('MONGODB_URI_PROD='));
  if (!line) return null;
  return line.slice('MONGODB_URI_PROD='.length).trim().replace(/^["']|["']$/g, '');
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const yes = argv.includes('--yes');

  const hosts = loadHosts();
  const prodUrl = hosts?.supabase?.production?.databaseUrl;
  if (!prodUrl || prodUrl.includes('YOUR-')) {
    console.error('Set supabase.production.databaseUrl in production-hosts.local.json');
    process.exit(1);
  }

  const mongoProd = loadMongoProdUri();
  if (!mongoProd) {
    console.error('Set MONGODB_URI_PROD in server/.env');
    process.exit(1);
  }

  console.log('\n*** PROD CUTOVER ETL ***');
  console.log('Target: Supabase PRODUCTION project');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  if (!dryRun && !yes) {
    console.error('Requires explicit --yes for live prod ETL.');
    process.exit(1);
  }

  const env = {
    ...process.env,
    DATABASE_URL: prodUrl,
    MONGODB_URI: mongoProd,
  };

  const nestDir = path.join(ROOT, 'nestjs-server');
  const push = spawnSync('npm', ['run', 'db:push'], {
    cwd: nestDir,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (push.status !== 0) process.exit(push.status ?? 1);

  const gen = spawnSync('npm', ['run', 'prisma:generate'], {
    cwd: nestDir,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (gen.status !== 0) process.exit(gen.status ?? 1);

  const tiers = dryRun ? ['--dry-run'] : [];
  for (let tier = 1; tier <= 4; tier += 1) {
    const r = spawnSync(
      'tsx',
      ['scripts/etl/mongo-to-postgres.ts', ...tiers, `--tier=${tier}`],
      { cwd: path.join(ROOT, 'nestjs-server'), env, stdio: 'inherit', shell: true }
    );
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  console.log('\nProd ETL done. Flip Render production DATABASE_URL, then strangler routes per domain.');
  console.log('Keep MONGODB_URI on Express until all domains ported. See docs/PREVIEW_SUPABASE_CUTOVER.md Phase E.\n');
}

main();
