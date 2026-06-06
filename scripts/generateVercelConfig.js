#!/usr/bin/env node
/**
 * Writes vercel.json /api rewrites from RENDER_API_PROXY_URL at build time.
 * No middleware — Vercel native rewrites proxy all methods + Set-Cookie reliably.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const proxyUrl = String(process.env.RENDER_API_PROXY_URL || process.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const onVercel = process.env.VERCEL === '1';

if (onVercel && !proxyUrl) {
  console.error(
    '[generateVercelConfig] RENDER_API_PROXY_URL required on Vercel — mobile login /api proxy will 404.'
  );
  process.exit(1);
}

const templatePath = path.join(ROOT, 'client', 'vercel.json.example');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

let apiDestination = 'https://YOUR-RENDER-SERVICE.onrender.com/api/$1';
if (proxyUrl) {
  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    console.error('[generateVercelConfig] Invalid RENDER_API_PROXY_URL:', proxyUrl);
    process.exit(1);
  }
  if (!parsed.hostname.endsWith('.onrender.com')) {
    console.error('[generateVercelConfig] Host must be *.onrender.com');
    process.exit(1);
  }
  apiDestination = `${parsed.origin}/api/$1`;
}

const payload = {
  rewrites: template.rewrites.map((rule) =>
    rule.source === '/api/(.*)'
      ? { ...rule, destination: apiDestination }
      : rule
  ),
  ...(template.buildCommand ? { buildCommand: template.buildCommand } : {}),
  ...(template.installCommand ? { installCommand: template.installCommand } : {}),
};

const targets = [path.join(ROOT, 'vercel.json'), path.join(ROOT, 'client', 'vercel.json')];
for (const file of targets) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[generateVercelConfig] wrote ${path.relative(ROOT, file)}`);
}

if (proxyUrl) {
  console.log(`[generateVercelConfig] /api rewrite → ${apiDestination.replace('/$1', '')}`);
}
