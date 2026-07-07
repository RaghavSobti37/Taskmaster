const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const HAVELLS_REPO_URL = process.env.HAVELLS_DATA_REPO_URL
  || 'https://github.com/ORG/havells-autodata.git';
const TASKMASTER_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_HAVELLS_ROOT = path.join(TASKMASTER_ROOT, '.data', 'havells-autodata');
const MARKER_REL = 'data/merged_havells_data.csv';
const LOCAL_FALLBACK_ROOT = process.env.HAVELLS_DATA_FALLBACK
  || path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'havells', 'havells-autodata');

function runGit(args) {
  const result = spawnSync('git', args, { stdio: 'inherit' });
  return result.status === 0;
}

function copyTree(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function resolveHavellsRoot(explicit = '') {
  if (explicit) return path.resolve(explicit);
  if (process.env.HAVELLS_DATA_ROOT) return path.resolve(process.env.HAVELLS_DATA_ROOT);
  return DEFAULT_HAVELLS_ROOT;
}

function hasHavellsData(root) {
  return fs.existsSync(path.join(root, MARKER_REL));
}

function seedFromFallback(root) {
  if (!hasHavellsData(LOCAL_FALLBACK_ROOT)) return false;
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  copyTree(LOCAL_FALLBACK_ROOT, root);
  return hasHavellsData(root);
}

function ensureHavellsClone({ root: explicitRoot = '', pull = false } = {}) {
  const root = resolveHavellsRoot(explicitRoot);
  fs.mkdirSync(path.dirname(root), { recursive: true });

  if (fs.existsSync(path.join(root, '.git'))) {
    if (!hasHavellsData(root)) {
      throw new Error(`Havells clone at ${root} is missing ${MARKER_REL}`);
    }
    if (pull && !runGit(['-C', root, 'pull', '--ff-only'])) {
      throw new Error('git pull failed for havells-autodata');
    }
    return root;
  }

  if (hasHavellsData(root)) return root;

  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }

  if (!runGit(['clone', '--depth', '1', HAVELLS_REPO_URL, root]) && !seedFromFallback(root)) {
    throw new Error(
      `Could not clone ${HAVELLS_REPO_URL}. Set HAVELLS_DATA_REPO_URL or place data at ${LOCAL_FALLBACK_ROOT}`
    );
  }

  if (!hasHavellsData(root)) {
    throw new Error(`Havells data at ${root} is missing ${MARKER_REL}`);
  }
  return root;
}

module.exports = {
  HAVELLS_REPO_URL,
  DEFAULT_HAVELLS_ROOT,
  LOCAL_FALLBACK_ROOT,
  MARKER_REL,
  resolveHavellsRoot,
  hasHavellsData,
  ensureHavellsClone,
};
