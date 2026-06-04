#!/usr/bin/env node
/**
 * Scan tracked files for hardcoded production hosts / secrets / PII that must not be committed.
 * Usage: npm run audit:exposure
 * Exit 1 on violations.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const EXT_SCAN = new Set([
  '.md',
  '.example',
  '.js',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
  '.mdc',
  '.mjs',
  '.ts',
  '.tsx',
]);

/** Never commit generated deploy configs with real hosts. */
const SKIP_FILES = new Set(['vercel.json', 'client/vercel.json']);

const SKIP_PATH_PREFIXES = ['server/tests/'];

/** Original PII / hosts only — placeholders (redacted@example.com, YOUR-RENDER-SERVICE) are OK. */
const BLOCKED_LITERALS = [
  'YOUR-RENDER-SERVICE.onrender.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
  'redacted@example.com',
  'redacted-staff@example.com',
  'redacted-staff@example.com',
  'redacted-staff@example.com',
  'redacted-staff@example.com',
  'github.com/YOUR_ORG',
  'YOUR_ORG/CoreKnot',
  'YOUR_ORG/Taskmaster',
];

const PATTERNS = [
  { id: 'render-host', re: /https?:\/\/[a-z0-9-]+\.onrender\.com/gi, label: 'Render API URL' },
  { id: 'mongodb-srv', re: /mongodb\+srv:\/\/[^\s'"`]+/gi, label: 'MongoDB Atlas URI' },
  { id: 'private-key', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, label: 'Private key PEM' },
  {
    id: 'personal-gmail',
    re: /[a-z0-9._%+-]+@gmail\.com/gi,
    label: 'Personal Gmail address',
  },
];

const isPlaceholderUri = (match) =>
  /\.\.\.|user:pass|u:p@|USER:PASS|your_|example|localhost/i.test(match);

const isAllowedRenderHost = (match) =>
  /YOUR[-_]RENDER|your[-_]render|example\.test|<[^>]+>|CoreKnot-jfw0|coreknot-api/i.test(
    match
  );

const isAllowedGmail = (match, rel) =>
  /placeholder@gmail|youraccount@gmail|example\.com/i.test(match) ||
  rel.includes('.env.example') ||
  rel.endsWith('AdminMailContent.jsx');

function listGitTrackedFiles() {
  const raw = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((rel) => {
      if (SKIP_FILES.has(rel)) return false;
      if (rel.includes('node_modules/')) return false;
      const ext = path.extname(rel);
      if (!EXT_SCAN.has(ext)) return false;
      return !SKIP_PATH_PREFIXES.some((p) => rel.startsWith(p));
    });
}

const violations = [];

for (const rel of listGitTrackedFiles()) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, 'utf8');

  for (const literal of BLOCKED_LITERALS) {
    if (content.toLowerCase().includes(literal.toLowerCase())) {
      violations.push({ rel, label: 'Blocked literal (PII/host)', match: literal });
    }
  }

  for (const { id, re, label } of PATTERNS) {
    re.lastIndex = 0;
    const matches = content.match(re);
    if (!matches) continue;

    for (const match of matches) {
      if (id === 'render-host' && isAllowedRenderHost(match)) continue;
      if (id === 'mongodb-srv' && isPlaceholderUri(match)) continue;
      if (id === 'private-key' && rel.endsWith('.env.example')) continue;
      if (id === 'personal-gmail' && isAllowedGmail(match, rel)) continue;

      violations.push({ rel, label, match: match.slice(0, 120) });
    }
  }
}

if (violations.length) {
  console.error('\nCommitted exposure check FAILED\n');
  for (const v of violations) {
    console.error(`  [${v.label}] ${v.rel}\n    ${v.match}\n`);
  }
  console.error(
    'Use env vars (ROOT_ADMIN_USER_IDS, PLATFORM_OWNER_USER_ID, RENDER_API_PROXY_URL) and placeholders in docs.\n' +
      'Deploy rewrites: vercel.json.example + scripts/generateVercelConfig.js at build time.\n'
  );
  process.exit(1);
}

console.log('Committed exposure check passed.');
process.exit(0);
