#!/usr/bin/env node
/**
 * Writes vercel.json rewrites from RENDER_API_PROXY_URL (build / deploy only).
 * Committed repo uses vercel.json.example — never commit production Render hostnames.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const proxyUrl = String(process.env.RENDER_API_PROXY_URL || '').trim().replace(/\/$/, '');

const templatePath = path.join(ROOT, 'vercel.json.example');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

if (!proxyUrl) {
  console.warn(
    '[generateVercelConfig] RENDER_API_PROXY_URL unset — skipping rewrite generation (local dev uses Vite proxy).'
  );
  process.exit(0);
}

let parsed;
try {
  parsed = new URL(proxyUrl);
} catch {
  console.error('[generateVercelConfig] RENDER_API_PROXY_URL is not a valid URL:', proxyUrl);
  process.exit(1);
}

if (!parsed.hostname.endsWith('.onrender.com')) {
  console.error('[generateVercelConfig] Host must be *.onrender.com');
  process.exit(1);
}

const apiBase = `${parsed.origin}/api`;
const out = {
  ...template,
  rewrites: template.rewrites.map((r) =>
    r.source === '/api/(.*)'
      ? { ...r, destination: `${apiBase}/$1` }
      : r
  ),
};

const targets = [path.join(ROOT, 'vercel.json'), path.join(ROOT, 'client', 'vercel.json')];
for (const file of targets) {
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`[generateVercelConfig] wrote ${path.relative(ROOT, file)}`);
}
