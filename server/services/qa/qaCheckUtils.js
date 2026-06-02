const fs = require('fs').promises;
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '../..');
const REPO_ROOT = path.join(__dirname, '../../..');

const makeCheck = (id, category, title, status, detail, evidence = '', severity = 'medium') => ({
  id,
  category,
  title,
  status,
  detail,
  evidence: String(evidence).slice(0, 2000),
  severity,
});

async function readText(relFromServer) {
  try {
    return await fs.readFile(path.join(SERVER_ROOT, relFromServer), 'utf8');
  } catch {
    return null;
  }
}

async function readRepoText(relFromRepo) {
  try {
    return await fs.readFile(path.join(REPO_ROOT, relFromRepo), 'utf8');
  } catch {
    return null;
  }
}

async function listFiles(dir, pattern = /\.js$/) {
  const out = [];
  const walk = async (d) => {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules') {
        await walk(full);
      } else if (ent.isFile() && pattern.test(ent.name)) {
        out.push(full);
      }
    }
  };
  await walk(dir);
  return out;
}

module.exports = {
  makeCheck,
  readText,
  readRepoText,
  listFiles,
  SERVER_ROOT,
  REPO_ROOT,
};
