#!/usr/bin/env node
/**
 * Post-clone / post-install setup.
 * - git hooks (husky)
 * - Junction symlink Taskmaster/shared -> shared (Windows)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const skipHooks =
  process.env.HUSKY === '0'
  || process.env.VERCEL === '1'
  || process.env.CI === '1'
  || process.env.RENDER === 'true'
  || Boolean(process.env.RENDER_SERVICE_ID);

/* --- git hooks (husky) --- */
if (!skipHooks) {
  try {
    execSync('husky', { stdio: 'inherit' });
  } catch {
    // Non-fatal when husky is missing (production install --omit=dev)
  }
}

/* --- Junction: Taskmaster/shared -> shared (Windows only) --- */
if (process.platform === 'win32') {
  const link = path.join(__dirname, '..', 'Taskmaster', 'shared');
  const target = path.join(__dirname, '..', 'shared');
  try {
    if (fs.existsSync(link)) {
      const stat = fs.lstatSync(link);
      if (stat.isSymbolicLink() || stat.isDirectory() && !stat.isFile()) {
        // Check if it's already a junction — skip if so
        try {
          const out = execSync(`powershell -Command "(Get-Item '${link.replace(/'/g, "''")}').LinkType -eq 'Junction'"`, { encoding: 'utf8' }).trim();
          if (out === 'True') return;
        } catch { /* fall through to recreate */ }
      }
      fs.rmSync(link, { recursive: true, force: true });
    }
    execSync(`powershell -Command "New-Item -Path '${link.replace(/'/g, "''")}' -ItemType Junction -Target '${target.replace(/'/g, "''")}' -Force"`, { stdio: 'pipe' });
    console.log('✓ Created junction: Taskmaster\shared → shared');
  } catch (e) {
    console.warn('⚠ Could not create Taskmaster/shared junction:', e.message);
    console.warn('  Run scripts/create-shared-junction.ps1 manually after clone.');
  }
}

