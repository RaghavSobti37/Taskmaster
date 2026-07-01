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

const SHIM_EXPORT_RE = /module\.exports\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/;

async function readText(relFromServer) {
  try {
    return await fs.readFile(path.join(SERVER_ROOT, relFromServer), 'utf8');
  } catch {
    return null;
  }
}

/** Read server file text, following one-line re-export shims into domains/. */
async function readTextResolved(relFromServer, { maxDepth = 4 } = {}) {
  let rel = relFromServer.replace(/\\/g, '/');
  const parts = [];
  for (let depth = 0; depth < maxDepth; depth += 1) {
    let content = await readText(rel);
    if (!content && !rel.endsWith('.js')) {
      content = await readText(`${rel}.js`);
      if (content) rel = `${rel}.js`;
    }
    if (!content) break;
    parts.push(content);
    const match = content.match(SHIM_EXPORT_RE);
    if (!match) break;
    const currentAbs = path.join(SERVER_ROOT, rel);
    let targetAbs = path.normalize(path.join(path.dirname(currentAbs), match[1]));
    if (!targetAbs.endsWith('.js')) targetAbs = `${targetAbs}.js`;
    const serverRootNorm = path.normalize(SERVER_ROOT);
    if (!targetAbs.startsWith(serverRootNorm)) break;
    rel = path.relative(serverRootNorm, targetAbs).replace(/\\/g, '/');
  }
  return parts.length ? parts.join('\n') : null;
}

/** Bootstrap split across server.js + app/* — concatenate for static QA probes. */
async function readBootstrapSources() {
  const parts = await Promise.all([
    readText('server.js'),
    readText('app/cors.js'),
    readText('utils/vercelOrigins.js'),
    readText('app/rateLimits.js'),
    readText('app/createApp.js'),
    readText('app/registerRoutes.js'),
  ]);
  return parts.filter(Boolean).join('\n');
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
  readTextResolved,
  readBootstrapSources,
  readRepoText,
  listFiles,
  SERVER_ROOT,
  REPO_ROOT,
};
