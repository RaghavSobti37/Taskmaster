#!/usr/bin/env node
/**
 * CI gate — tenant bypass allowlist static checks.
 */
const { runSuite3StaticChecks } = require('../services/qa/qaSuite3Static');

(async () => {
  const checks = await runSuite3StaticChecks();
  const failures = checks.filter((c) => c.status === 'fail');
  const warns = checks.filter((c) => c.status === 'warn');

  for (const c of checks) {
    const mark = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '?';
    console.log(`${mark} ${c.id}: ${c.message}`);
  }

  if (warns.length) {
    console.warn(`\n${warns.length} warning(s)`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} failed static check(s)`);
    process.exit(1);
  }

  console.log(`\n${checks.length} static checks passed`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
