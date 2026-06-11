#!/usr/bin/env node
/** Skip git hooks on CI/Vercel — husky binary may not be on PATH during workspace install. */
if (process.env.HUSKY === '0' || process.env.VERCEL === '1' || process.env.CI === '1') {
  process.exit(0);
}
require('child_process').execSync('husky', { stdio: 'inherit' });
