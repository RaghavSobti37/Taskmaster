#!/usr/bin/env node
/**
 * Print Vercel Preview environment variables for staging API wiring.
 */
const fs = require('fs');
const path = require('path');

const HOSTS_PATH = path.join(__dirname, '../.cursor/production-hosts.local.json');
const EXAMPLE = path.join(__dirname, '../.cursor/production-hosts.local.example.json');

function main() {
  const file = fs.existsSync(HOSTS_PATH) ? HOSTS_PATH : EXAMPLE;
  const hosts = JSON.parse(fs.readFileSync(file, 'utf8'));
  const staging = hosts.stagingApiUrl || 'https://YOUR-STAGING-SERVICE.onrender.com';

  console.log('\nVercel Dashboard → Project → Settings → Environment Variables → Preview\n');
  console.log(`VITE_API_URL=${staging}`);
  console.log(`RENDER_API_PROXY_URL=${staging}`);
  console.log('\nProduction env stays on productionApiUrl — do not copy Preview vars to Production.');
  console.log('Regenerate vercel.json: node scripts/generateVercelConfig.js (if used)\n');
}

main();
