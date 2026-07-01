/** Jest launcher — strips Vitest-only `--run` so npm test works from client and server verify commands. */
const { spawnSync } = require('child_process');
const path = require('path');

const jestBin = path.join(__dirname, '../../node_modules/jest/bin/jest.js');
const args = process.argv.slice(2).filter((arg) => arg !== '--run');

const result = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', jestBin, ...args],
  { stdio: 'inherit', cwd: path.join(__dirname, '..') },
);

process.exit(result.status === null ? 1 : result.status);
