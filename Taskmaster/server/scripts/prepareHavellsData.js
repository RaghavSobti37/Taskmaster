const { ensureHavellsClone, DEFAULT_HAVELLS_ROOT } = require('../lib/havellsDataRoot');

function readArg(name, fallback = '') {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.slice(name.length + 1);
}

async function main() {
  const pull = process.argv.includes('--pull');
  const root = ensureHavellsClone({ root: readArg('--root', ''), pull });
  console.log('[prepareHavellsData] ready');
  console.log(JSON.stringify({ root, defaultRoot: DEFAULT_HAVELLS_ROOT, pulled: pull }, null, 2));
}

main().catch((error) => {
  console.error('[prepareHavellsData] Failed:', error.message);
  process.exit(1);
});
