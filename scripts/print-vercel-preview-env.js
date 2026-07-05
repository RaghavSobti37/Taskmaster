#!/usr/bin/env node
/**
 * Print Vercel Preview environment variables — same production API as prod frontend.
 */
const fs = require('fs');
const path = require('path');

const HOSTS_PATH = path.join(__dirname, '../.cursor/production-hosts.local.json');
const EXAMPLE = path.join(__dirname, '../.cursor/production-hosts.local.example.json');

function main() {
  const file = fs.existsSync(HOSTS_PATH) ? HOSTS_PATH : EXAMPLE;
  let prod = 'https://YOUR-PRODUCTION-API.onrender.com';
  if (fs.existsSync(file)) {
    const hosts = JSON.parse(fs.readFileSync(file, 'utf8'));
    prod = hosts.productionApiUrl || hosts.derived?.renderApiProxyUrl || prod;
  }

  console.log('\nVercel Dashboard → Project → Settings → Environment Variables → Preview\n');
  console.log(`VITE_API_URL=${prod}`);
  console.log(`RENDER_API_PROXY_URL=${prod}`);
  console.log('\nStaging Vercel builds use the production API + production MongoDB.');
  console.log('Or run: npm run preview:vercel-env:push\n');
}

main();
