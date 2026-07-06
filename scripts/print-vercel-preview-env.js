#!/usr/bin/env node
/**
 * Print Vercel Preview environment variables — staging API (taskmaster_staging).
 */
const fs = require('fs');
const path = require('path');

const HOSTS_PATH = path.join(__dirname, '../.cursor/production-hosts.local.json');
const EXAMPLE = path.join(__dirname, '../.cursor/production-hosts.local.example.json');
const DEFAULT_STAGING = 'https://coreknot-api-staging.onrender.com';

function main() {
  const file = fs.existsSync(HOSTS_PATH) ? HOSTS_PATH : EXAMPLE;
  let staging = DEFAULT_STAGING;
  if (fs.existsSync(file)) {
    const hosts = JSON.parse(fs.readFileSync(file, 'utf8'));
    staging = hosts.stagingApiUrl || hosts.derived?.stagingApiUrl || staging;
  }

  console.log('\nVercel Dashboard → Project → Settings → Environment Variables → Preview\n');
  console.log(`VITE_API_URL=${staging}`);
  console.log(`RENDER_API_PROXY_URL=${staging}`);
  console.log('\nStaging Vercel builds use coreknot-api-staging + taskmaster_staging MongoDB.');
  console.log('Or run: npm run preview:vercel-env:push\n');
}

main();
