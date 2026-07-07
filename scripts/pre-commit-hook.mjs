#!/usr/bin/env node
/**
 * Husky pre-commit with visible progress.
 * eslint on full client takes ~30–60s — wait for "[main …] fix: …" before pushing.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runStep(index, total, label, npmArgs) {
  const started = Date.now();
  process.stdout.write(`\n[pre-commit ${index}/${total}] ${label}\n`);
  process.stdout.write('  running… (wait — do not Ctrl+C)\n\n');

  const result = spawnSync('npm', npmArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    process.stderr.write(`\n[pre-commit] FAILED: ${label} (${seconds}s)\n`);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(`\n[pre-commit] OK: ${label} (${seconds}s)\n`);
}

runStep(1, 2, 'audit:exposure (secrets in staged files)', ['run', 'audit:exposure']);
runStep(2, 2, 'eslint client (full tree — usually 30–60s)', ['run', 'lint', '--prefix', 'client', '--', '--quiet']);

process.stdout.write('\n[pre-commit] all checks passed — creating commit…\n\n');
