#!/usr/bin/env node
/**
 * Print data-environment readiness for local / preview / prod cutover.
 * Usage: node server/scripts/verifyDataEnvReadiness.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { isDataHubReconcileEnabled } = require('../utils/dataHubFlags');

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return (match && match[2]) ? decodeURIComponent(match[2]) : fallback;
}

function check(label, ok, detail = '') {
  const icon = ok ? 'PASS' : 'WARN';
  console.log(`  [${icon}] ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log('\n=== Data environment readiness ===\n');

  const localDb = dbNameFromUri(process.env.MONGODB_URI, 'taskmaster_local');
  const syncMode = String(process.env.SYNC_MODE || 'full').trim().toLowerCase();
  const reconcile = isDataHubReconcileEnabled();

  console.log('Local Express (Mongo)');
  check('MONGODB_URI set', Boolean(process.env.MONGODB_URI), localDb);
  check('Local DB name contains "local"', localDb.includes('local'));
  check('SYNC_MODE operational (recommended)', syncMode === 'operational', syncMode);
  check('DATA_HUB_RECONCILE_ENABLED false locally', !reconcile || process.env.NODE_ENV === 'production');
  check('MAIL_USE_PROD_DB false', process.env.MAIL_USE_PROD_DB !== 'true');

  console.log('\nLocal NestJS (Docker Postgres)');
  const dbUrl = process.env.DATABASE_URL || '';
  check(
    'DATABASE_URL points to localhost/docker',
    dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'),
    dbUrl ? 'set' : 'unset — use nestjs-server/.env'
  );

  const nestEnvPath = path.join(__dirname, '../../nestjs-server/.env');
  let nestJwt = '';
  if (require('fs').existsSync(nestEnvPath)) {
    const nestRaw = require('fs').readFileSync(nestEnvPath, 'utf8');
    nestJwt = (nestRaw.match(/^JWT_SECRET=(.*)$/m) || [])[1]?.trim() || '';
  }
  const serverJwt = String(process.env.JWT_SECRET || '').trim();
  check(
    'JWT_SECRET matches server + nestjs-server/.env',
    Boolean(serverJwt && nestJwt && serverJwt === nestJwt),
    serverJwt ? 'aligned' : 'run npm run local:sync-env'
  );

  console.log('\nPreview / prod Supabase (manual)');
  check(
    'MONGODB_URI_PROD set (ETL source)',
    Boolean(process.env.MONGODB_URI_PROD),
    'for preview ETL only'
  );
  check(
    'SUPABASE preview URL documented',
    true,
    'see .cursor/production-hosts.local.json → supabase.preview'
  );
  check(
    'stagingApiUrl for Vercel preview',
    true,
    'see production-hosts.local.example.json'
  );

  console.log('\nCommands');
  console.log('  npm run local:sync-env');
  console.log('  npm run local:setup');
  console.log('  npm run local:verify');
  console.log('  npm run sync:prod-to-local:operational');
  console.log('  npm run purge:local-crm-datahub');
  console.log('  cd nestjs-server && npm run db:setup && npm run etl:local-operational');
  console.log('  docs/PREVIEW_SUPABASE_CUTOVER.md');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
