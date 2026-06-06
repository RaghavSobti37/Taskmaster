#!/usr/bin/env node
/**
 * Syncs SPA vercel.json + validates RENDER_API_PROXY_URL on Vercel builds.
 * /api/* is proxied at runtime by client/middleware.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const proxyUrl = String(process.env.RENDER_API_PROXY_URL || process.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const onVercel = process.env.VERCEL === '1';

if (onVercel && !proxyUrl) {
  console.error(
    '[generateVercelConfig] RENDER_API_PROXY_URL (or VITE_API_URL) required on Vercel for /api proxy.'
  );
  process.exit(1);
}

const templatePath = path.join(ROOT, 'client', 'vercel.json.example');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const payload = {
  rewrites: template.rewrites,
  ...(template.buildCommand ? { buildCommand: template.buildCommand } : {}),
};

const targets = [path.join(ROOT, 'vercel.json'), path.join(ROOT, 'client', 'vercel.json')];
for (const file of targets) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[generateVercelConfig] synced ${path.relative(ROOT, file)}`);
}

if (proxyUrl) {
  console.log(`[generateVercelConfig] edge /api proxy target: ${proxyUrl}`);
}
