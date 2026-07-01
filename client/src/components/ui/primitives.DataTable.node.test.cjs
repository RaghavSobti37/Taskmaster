const { spawnSync } = require('node:child_process');
const test = require('node:test');
const path = require('node:path');

const clientRoot = path.join(__dirname, '../../..');
const vitestTarget = 'src/components/ui/primitives.DataTable.test.jsx';

test('DataTable component tests (vitest)', () => {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vitest', 'run', vitestTarget],
    { cwd: clientRoot, stdio: 'inherit', shell: true, env: process.env },
  );
  if (result.status !== 0) {
    throw new Error(`vitest failed for ${vitestTarget}`);
  }
});
