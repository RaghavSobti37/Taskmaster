/**
 * Ping API health endpoint to reduce Render cold starts.
 * Used by CoreKnot-keep-warm cron (render.yaml).
 */
const https = require('https');
const http = require('http');

const url = process.env.KEEP_WARM_URL || process.env.API_HEALTH_URL;
if (!url) {
  console.error('[keep-warm] KEEP_WARM_URL or API_HEALTH_URL required');
  process.exit(1);
}
const client = url.startsWith('https') ? https : http;

client
  .get(url, (res) => {
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    console.log(`[keep-warm] ${url} → ${res.statusCode}`);
    process.exit(ok ? 0 : 1);
  })
  .on('error', (err) => {
    console.error('[keep-warm] failed:', err.message);
    process.exit(1);
  });
