const { spawnSync } = require('node:child_process');
const test = require('node:test');
const path = require('node:path');

const clientRoot = path.join(__dirname, '../..');
const vitestTargets = [
  'src/hooks/useEscapeBack.test.jsx',
  'src/hooks/useBreakpoint.pullToRefresh.test.js',
  'src/lib/escapeBack.test.js',
  'src/lib/modalEnter.test.js',
  'src/lib/publicRouteTheme.test.js',
  'src/utils/coerceTableRows.test.js',
];

function runVitest(relativePath) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vitest', 'run', relativePath],
    { cwd: clientRoot, stdio: 'inherit', shell: true, env: process.env },
  );
  if (result.status !== 0) {
    throw new Error(`vitest failed: ${relativePath}`);
  }
}

for (const target of vitestTargets) {
  test(`client-interactions: ${target}`, () => {
    runVitest(target);
  });
}
