#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(label, args) {
  process.stdout.write(`\n[pre-push] ${label}\n`);
  const result = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('Generate docs artifacts', ['run', 'docs:generate']);
run('Sync Obsidian memory', ['run', 'memory:obsidian:sync']);

const addResult = spawnSync('git', ['add', 'docs/.generated', 'docs/reference/COREKNOT_MASTER.md', 'memory/obsidian', '.specify/memory/INDEX.md'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (addResult.status !== 0) process.exit(addResult.status ?? 1);

console.log('\n[pre-push] Docs + memory regenerated and staged.');
