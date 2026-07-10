#!/usr/bin/env node
/**
 * Seed Music Content Calendar + full Data Hub reconcile on production.
 * Usage: node server/scripts/seedProductionContent.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const path = require('path');

const node = process.execPath;
const scriptsDir = __dirname;
const dryRun = process.argv.includes('--dry-run');
const year = new Date().getFullYear();

function run(label, script, extraArgs = []) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(node, [path.join(scriptsDir, script), ...extraArgs], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

async function main() {
  const seedArgs = [`--year=${year}`, '--prod'];
  if (dryRun) seedArgs.push('--dry-run');

  run('Music Content Calendar', 'seedMusicContentCalendar.js', seedArgs);

  if (!dryRun) {
    run('Data Hub full reconcile', 'reconcileDataHub.js', ['--prod', '--full']);
  } else {
    console.log('\n(dry-run: skipping Data Hub reconcile)');
  }

  console.log('\nProduction content sync complete.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
