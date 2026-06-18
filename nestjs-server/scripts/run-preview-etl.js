#!/usr/bin/env node
/**
 * Full prod Mongo → Supabase preview ETL.
 * Reads credentials from .cursor/production-hosts.local.json (gitignored).
 *
 * Usage:
 *   node scripts/run-preview-etl.js --dry-run
 *   node scripts/run-preview-etl.js --yes
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const HOSTS_PATH = path.join(ROOT, '.cursor/production-hosts.local.json');
const SERVER_ENV = path.join(ROOT, 'server/.env');

function loadHosts() {
  if (!fs.existsSync(HOSTS_PATH)) {
    console.error(
      'Missing .cursor/production-hosts.local.json — copy from production-hosts.local.example.json'
    );
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
  const previewUrl = hosts?.supabase?.preview?.databaseUrl;
  if (!previewUrl || previewUrl.includes('YOUR-')) {
    console.error('Set supabase.preview.databaseUrl in production-hosts.local.json');
    process.exit(1);
  }

  const mongoProd = loadMongoProdUri();
  if (!mongoProd) {
    console.error('Set MONGODB_URI_PROD in server/.env (prod read-only)');
    process.exit(1);
  }

  console.log('\nPreview ETL');
  console.log('  Target: Supabase preview project');
  console.log('  Source: MONGODB_URI_PROD');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  if (!dryRun && !yes) {
    console.error('Add --yes to run live ETL, or --dry-run first.');
    process.exit(1);
  }

  const env = {
    ...process.env,
    DATABASE_URL: previewUrl,
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
  const steps = [
    ['tsx', ['scripts/etl/mongo-to-postgres.ts', ...tiers, '--tier=1']],
    ['tsx', ['scripts/etl/mongo-to-postgres.ts', ...tiers, '--tier=2']],
    ['tsx', ['scripts/etl/mongo-to-postgres.ts', ...tiers, '--tier=3']],
    ['tsx', ['scripts/etl/mongo-to-postgres.ts', ...tiers, '--tier=4']],
  ];

  for (const [cmd, args] of steps) {
    const r = spawnSync(cmd, args, {
      cwd: path.join(ROOT, 'nestjs-server'),
      env,
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  console.log('\nPreview ETL complete. Next: Render staging DATABASE_URL + Vercel Preview env.');
  console.log('See docs/PREVIEW_SUPABASE_CUTOVER.md Phase C–D\n');
}

main();
