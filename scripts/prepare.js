#!/usr/bin/env node
/** Skip git hooks on CI/Vercel/Render — husky may not be on PATH during cloud install. */
const skipHooks =
  process.env.HUSKY === '0'
  || process.env.VERCEL === '1'
  || process.env.CI === '1'
  || process.env.RENDER === 'true'
  || Boolean(process.env.RENDER_SERVICE_ID);

if (skipHooks) {
  process.exit(0);
}

try {
  require('child_process').execSync('husky', { stdio: 'inherit' });
} catch {
  // Non-fatal when husky is missing (production install --omit=dev)
  process.exit(0);
}
