#!/usr/bin/env node
/**
 * Delete PostHog persons that are not real @theshakticollective.in team members.
 * Skips e2e-agent-* and anonymous UUID visitors.
 *
 * Requires POSTHOG_PERSONAL_API_KEY (User API key with person:write) or phx_ from PostHog settings.
 * Optional: POSTHOG_PROJECT_ID (default 468825)
 *
 * Usage: node scripts/posthog-cleanup-persons.mjs [--dry-run]
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

/** Comma-separated allowlist, e.g. POSTHOG_KEEP_EMAILS=alice@company.com,bob@company.com */
const loadKeepEmails = () => {
  const fromEnv = process.env.POSTHOG_KEEP_EMAILS?.trim();
  if (fromEnv) {
    return new Set(fromEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
  }
  const localFile = join(root, '.cursor', 'posthog-keep-emails.local.txt');
  if (existsSync(localFile)) {
    return new Set(
      readFileSync(localFile, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.replace(/#.*$/, '').trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return new Set();
};

const KEEP_EMAILS = loadKeepEmails();

const loadKey = () => {
  if (process.env.POSTHOG_PERSONAL_API_KEY?.trim()) return process.env.POSTHOG_PERSONAL_API_KEY.trim();
  const candidates = [
    join(root, '.cursor', 'posthog.local.env'),
    join(root, 'server', '.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^POSTHOG_PERSONAL_API_KEY=(.+)$/m)
      || readFileSync(file, 'utf8').match(/^POSTHOG_PROJECT_API_KEY=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
};

const apiKey = loadKey();
const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || '468825';
const host = process.env.POSTHOG_HOST?.trim() || 'https://us.posthog.com';

if (!apiKey) {
  console.error('Missing POSTHOG_PERSONAL_API_KEY (person:write). Set env or .cursor/posthog.local.env');
  process.exit(1);
}

if (KEEP_EMAILS.size === 0) {
  console.error('Set POSTHOG_KEEP_EMAILS or .cursor/posthog-keep-emails.local.txt (one email per line).');
  process.exit(1);
}

const shouldKeep = (person) => {
  const email = String(person.properties?.email || person.name || '').trim().toLowerCase();
  if (!email.endsWith('@theshakticollective.in')) return false;
  if (email.startsWith('e2e-agent')) return false;
  return KEEP_EMAILS.has(email);
};

async function listAllPersons() {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const url = `${host}/api/projects/${projectId}/persons/?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`list persons ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const batch = data.results || [];
    all.push(...batch);
    if (!data.next || batch.length < limit) break;
    offset += limit;
  }
  return all;
}

async function bulkDelete(ids) {
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const res = await fetch(`${host}/api/projects/${projectId}/persons/bulk_delete/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: chunk,
        delete_events: true,
        delete_recordings: true,
      }),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`bulk_delete ${res.status}: ${await res.text()}`);
    }
    console.log(`Queued delete for ${chunk.length} persons (${res.status})`);
  }
}

const persons = await listAllPersons();
const keep = persons.filter(shouldKeep);
const remove = persons.filter((p) => !shouldKeep(p));

console.log(`Total: ${persons.length} | keep: ${keep.length} | delete: ${remove.length}`);
keep.forEach((p) => console.log(`  keep: ${p.properties?.email || p.name}`));

if (dryRun) {
  console.log('Dry run — no deletions.');
  process.exit(0);
}

if (remove.length === 0) {
  console.log('Nothing to delete.');
  process.exit(0);
}

await bulkDelete(remove.map((p) => p.id));
console.log('Done. PostHog processes deletes asynchronously — refresh Persons in ~1–5 min.');
