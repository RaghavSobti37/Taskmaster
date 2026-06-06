#!/usr/bin/env node
/**
 * Smoke-test frontend /api proxy (mobile login path).
 * Usage: node scripts/verifyMobileApiProxy.js [frontendOrigin]
 */
const https = require('https');

const frontend = (process.argv[2] || process.env.FRONTEND_URL || 'https://tsccoreknot.com').replace(/\/$/, '');
const healthUrl = `${frontend}/api/health`;

const run = () => new Promise((resolve) => {
  https
    .get(healthUrl, { headers: { 'User-Agent': 'CoreKnotMobileProxyCheck/1.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: body.slice(0, 200) });
      });
    })
    .on('error', (err) => resolve({ status: 0, error: err.message }));
});

(async () => {
  const result = await run();
  if (result.status === 200) {
    console.log(`[verifyMobileApiProxy] OK ${healthUrl} → 200`);
    process.exit(0);
  }

  console.error(`[verifyMobileApiProxy] FAIL ${healthUrl} → ${result.status || 'error'}`);
  if (result.error) console.error(`  error: ${result.error}`);
  if (result.body) console.error(`  body: ${result.body}`);
  console.error('');
  console.error('Mobile browsers use same-origin /api. Fix:');
  console.error('  1. Set RENDER_API_PROXY_URL on Vercel (Production + Preview)');
  console.error('  2. Redeploy frontend (prevercel-build runs generateVercelConfig.js)');
  console.error('  3. Confirm GET /api/health returns 200 on your frontend domain');
  process.exit(1);
})();
