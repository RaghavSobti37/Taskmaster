#!/usr/bin/env node
/**
 * Environment pre-flight — run before local dev or deploy.
 * Usage: node server/scripts/preflightEnv.js
 * Exit 0 = OK (warnings allowed), 1 = blocking errors.
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/** Suspended / retired Render API — must not be used for tracking or SERVER_URL. */
const RETIRED_RENDER_HOSTS = ['taskmaster' + '-jfw0' + '.onrender.com'];

const readEnv = (overrides = {}) => (key) =>
  (overrides[key] !== undefined ? overrides[key] : process.env[key] || '').trim();

const collectPreflightIssues = (overrides = {}) => {
  const errors = [];
  const warnings = [];
  const env = readEnv(overrides);

  const pushUrlIssue = (label, url) => {
    if (!url) return;
    const lower = url.toLowerCase();
    for (const bad of RETIRED_RENDER_HOSTS) {
      if (lower.includes(bad)) {
        errors.push(`${label} uses retired host (${bad}). Set SERVER_URL / TRACKING_BASE_URL in Render dashboard.`);
      }
    }
  };

  if (!env('MONGODB_URI') && process.env.NODE_ENV !== 'test') {
    errors.push('MONGODB_URI is missing (copy server/.env.example → server/.env).');
  }

  const jwt = env('JWT_SECRET');
  if (!jwt || jwt === 'your_secure_secret_here') {
    errors.push('JWT_SECRET is missing or still the template placeholder.');
  }

  if (env('MAIL_USE_PROD_DB') === 'true' && env('NODE_ENV') !== 'production') {
    warnings.push('MAIL_USE_PROD_DB=true — local server may write mail events to production DB.');
  }

  if (env('USE_PROD_DB') === 'true' || env('ALLOW_PROD_DB_IN_DEV') === 'true') {
    warnings.push('Production DB override enabled for dev — verify intent.');
  }

  pushUrlIssue('TRACKING_BASE_URL', env('TRACKING_BASE_URL'));
  pushUrlIssue('APP_BASE_URL', env('APP_BASE_URL'));
  pushUrlIssue('SERVER_URL', env('SERVER_URL'));
  pushUrlIssue('TRACKING_PUBLIC_FALLBACK', env('TRACKING_PUBLIC_FALLBACK'));

  const viteApi = env('VITE_API_URL');
  if (viteApi) pushUrlIssue('VITE_API_URL', viteApi);

  if (!env('REDIS_URL') && !env('REDIS_HOST')) {
    warnings.push('REDIS_URL / REDIS_HOST unset — queues and notification locks use in-memory fallback.');
  }

  const clientEnvPath = path.join(__dirname, '..', '..', 'client', '.env');
  if (fs.existsSync(clientEnvPath)) {
    const raw = fs.readFileSync(clientEnvPath, 'utf8');
    for (const bad of RETIRED_RENDER_HOSTS) {
      if (raw.toLowerCase().includes(bad)) {
        errors.push(`client/.env references retired host (${bad}).`);
      }
    }
    const prodRender =
      /vite_api_url\s*=\s*https?:\/\/[^/\s]*onrender\.com/i.test(raw) &&
      !/localhost/i.test(raw);
    if (prodRender && env('NODE_ENV') !== 'production') {
      warnings.push('client/.env may point VITE_API_URL at Render — local dev should use localhost:5000.');
    }
  }

  return { errors, warnings };
};

if (require.main === module) {
  const { errors, warnings } = collectPreflightIssues();

  console.log('\nCoreKnot pre-flight\n');
  console.log(`NODE_ENV: ${readEnv()('NODE_ENV') || '(unset)'}\n`);

  if (warnings.length) {
    console.log('Warnings:');
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  if (errors.length) {
    console.log('Errors:');
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('\nSee docs/ENVIRONMENT_MATRIX.md — set hosts in dashboard env, not in committed docs.\n');
    process.exit(1);
  }

  console.log('✓ Required checks passed.\n');
  process.exit(0);
}

module.exports = { collectPreflightIssues, RETIRED_RENDER_HOSTS };
