/**
 * Load RENDER_API_KEY without printing it.
 * Search order: process.env → server/.env → server/.env.render → .cursor/render-api.local.env
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let loaded = false;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
      loaded = true;
    }
  }
  return loaded;
}

function loadRenderApiKey() {
  if ((process.env.RENDER_API_KEY || '').trim()) {
    return process.env.RENDER_API_KEY.trim();
  }

  const candidates = [
    path.join(ROOT, 'server', '.env'),
    path.join(ROOT, 'server', '.env.render'),
    path.join(ROOT, '.cursor', 'render-api.local.env'),
  ];

  for (const file of candidates) {
    parseEnvFile(file);
    const key = (process.env.RENDER_API_KEY || '').trim();
    if (key) return key;
  }

  return '';
}

function renderApiKeyHint() {
  return [
    'RENDER_API_KEY not found. Option C requires one of:',
    '  1. coreknot/Taskmaster/server/.env → RENDER_API_KEY=rnd_...',
    '  2. coreknot/Taskmaster/.cursor/render-api.local.env (copy from .cursor/render-api.local.env.example)',
    '  3. $env:RENDER_API_KEY="rnd_..." in PowerShell before deploy',
    '  4. GitHub repo secret RENDER_API_KEY (for deploy-render-staging workflow)',
    '  5. Cursor Settings → MCP → render → env RENDER_API_KEY',
    '',
    'Create key: Render Dashboard → Account Settings → API Keys',
  ].join('\n');
}

module.exports = { loadRenderApiKey, renderApiKeyHint, parseEnvFile };
