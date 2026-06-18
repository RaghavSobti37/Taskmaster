#!/usr/bin/env node
/**
 * Sync Render service buildCommand + rootDir from render.yaml conventions.
 * Fixes Dashboard drift (e.g. bare `npm install` → ENOTEMPTY on cached node_modules).
 *
 * Usage:
 *   RENDER_API_KEY=rnd_... node scripts/syncRenderBuildCommands.js
 *   RENDER_API_KEY=rnd_... node scripts/syncRenderBuildCommands.js --deploy
 *   RENDER_API_KEY=rnd_... node scripts/syncRenderBuildCommands.js --deploy --clear-cache
 */
const API_BASE = 'https://api.render.com/v1';

const apiKey = (process.env.RENDER_API_KEY || '').trim();
const shouldDeploy = process.argv.includes('--deploy');
const clearCache = process.argv.includes('--clear-cache');

const BUILD = {
  api: {
    rootDir: 'server',
    buildCommand: 'cd .. && bash scripts/render-build.sh api',
    startCommand: 'npm start',
  },
  nest: {
    rootDir: 'nestjs-server',
    buildCommand: 'cd .. && bash scripts/render-build.sh nest',
    startCommand: 'npm run start:prod',
  },
};

function resolveSpec(service) {
  const name = String(service.name || '').toLowerCase();
  const type = String(service.type || '').toLowerCase();

  if (name.includes('nest')) return BUILD.nest;
  if (type === 'cron_job' || name.includes('backup') || name.includes('keep-warm')
    || name.includes('digest') || name.includes('reminder') || name.includes('subscription')) {
    return { rootDir: BUILD.api.rootDir, buildCommand: BUILD.api.buildCommand };
  }
  if (name.includes('coreknot') || name.includes('taskmaster') || type.includes('web')) {
    return BUILD.api;
  }
  return null;
}

async function renderFetch(method, route, body) {
  const response = await fetch(`${API_BASE}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload?.message
        ? payload.message
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
    throw new Error(`${method} ${route} failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function listAllServices() {
  const services = [];
  let cursor = null;

  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page = await renderFetch('GET', `/services?${query.toString()}`);
    const rows = Array.isArray(page) ? page : [];
    for (const row of rows) {
      if (row?.service) services.push(row.service);
    }
    cursor = page?.cursor || null;
  } while (cursor);

  return services;
}

async function patchServiceBuild(service, spec) {
  const envKey = service.env || 'node';
  const body = {
    rootDir: spec.rootDir,
    serviceDetails: {
      env: envKey,
      envSpecificDetails: {
        buildCommand: spec.buildCommand,
        ...(spec.startCommand ? { startCommand: spec.startCommand } : {}),
      },
    },
  };

  await renderFetch('PATCH', `/services/${service.id}`, body);
}

async function triggerDeploy(serviceId) {
  return renderFetch('POST', `/services/${serviceId}/deploys`, {
    clearCache: clearCache ? 'clear' : 'do_not_clear',
  });
}

async function main() {
  if (!apiKey) {
    console.error('\nRENDER_API_KEY is required.');
    console.error('  $env:RENDER_API_KEY="rnd_..."; node scripts/syncRenderBuildCommands.js --deploy --clear-cache\n');
    process.exit(1);
  }

  const services = await listAllServices();
  if (!services.length) {
    console.error('No Render services found for this API key.');
    process.exit(1);
  }

  console.log('\nSync Render build commands\n');

  let updated = 0;
  for (const service of services) {
    const spec = resolveSpec(service);
    if (!spec) {
      console.log(`- skip ${service.name} (${service.type})`);
      continue;
    }

    const current = service.serviceDetails?.envSpecificDetails || {};
    const sameBuild = current.buildCommand === spec.buildCommand;
    const sameRoot = (service.rootDir || '') === spec.rootDir;

    if (sameBuild && sameRoot) {
      console.log(`✓ ${service.name} already synced`);
      continue;
    }

    console.log(`→ ${service.name}`);
    console.log(`    rootDir: ${service.rootDir || '(empty)'} → ${spec.rootDir}`);
    console.log(`    build:   ${current.buildCommand || '(empty)'}`);
    console.log(`         → ${spec.buildCommand}`);

    await patchServiceBuild(service, spec);
    updated += 1;
    console.log('    patched');

    if (shouldDeploy && /coreknot-api|taskmaster/i.test(String(service.name))) {
      await triggerDeploy(service.id);
      console.log(`    deploy triggered${clearCache ? ' (cache cleared)' : ''}`);
    }
  }

  console.log(`\nDone. ${updated} service(s) updated.\n`);
  if (!shouldDeploy) {
    console.log('Run with --deploy --clear-cache to redeploy API after sync.\n');
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
