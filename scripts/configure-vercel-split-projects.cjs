#!/usr/bin/env node
/**
 * Point coreknot-landing / coreknot-auth at sites/* and copy vercel.json build settings.
 * Requires VERCEL_TOKEN in .cursor/vercel-api.local.env or env.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TEAM_ID = 'team_6ew6oULCB5ybymCVS2BgJyKv';

const PROJECTS = [
  { name: 'coreknot-landing', rootDirectory: 'sites/landing' },
  { name: 'coreknot-auth', rootDirectory: 'sites/auth' },
];

function loadToken() {
  const envPath = path.join(ROOT, '.cursor', 'vercel-api.local.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^VERCEL_TOKEN=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return (process.env.VERCEL_TOKEN || '').trim();
}

async function vercelFetch(token, method, route, body) {
  const res = await fetch(`https://api.vercel.com${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    const detail = payload?.error?.message || payload?.message || text;
    throw new Error(`${method} ${route} → ${res.status}: ${detail}`);
  }
  return payload;
}

async function main() {
  let token = loadToken();
  if (!token) {
    try {
      token = execSync('npx vercel project token coreknot-landing', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).pop();
    } catch {
      token = '';
    }
  }
  if (!token) {
    console.error('Missing VERCEL_TOKEN — add .cursor/vercel-api.local.env');
    process.exit(1);
  }

  const teamQ = `?teamId=${TEAM_ID}`;
  const list = await vercelFetch(token, 'GET', `/v9/projects${teamQ}`);
  const byName = new Map((list.projects || []).map((p) => [p.name, p]));

  for (const spec of PROJECTS) {
    const project = byName.get(spec.name);
    if (!project?.id) {
      console.warn(`Skip ${spec.name} — project not found`);
      continue;
    }
    const vercelJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, spec.rootDirectory, 'vercel.json'), 'utf8'),
    );
    await vercelFetch(token, 'PATCH', `/v9/projects/${project.id}${teamQ}`, {
      rootDirectory: spec.rootDirectory,
      buildCommand: vercelJson.buildCommand,
      installCommand: vercelJson.installCommand,
      outputDirectory: vercelJson.outputDirectory,
      framework: null,
    });
    console.log(`✓ ${spec.name} → root ${spec.rootDirectory}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
