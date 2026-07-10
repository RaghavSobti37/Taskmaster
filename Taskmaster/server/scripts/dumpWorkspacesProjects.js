const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

function readMongoUriFromEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => /^MONGODB_URI=/.test(l) && !/^MONGODB_URI_PROD=/.test(l));
  if (!line) throw new Error('MONGODB_URI not found in server/.env');
  return line.replace(/^MONGODB_URI=/, '').trim().replace(/^["']|["']$/g, '');
}

(async () => {
  const dbUri = readMongoUriFromEnvFile();
  await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 12000 });

  const workspaces = await Workspace.find().sort({ order: 1, name: 1 }).lean();
  const projects = await Project.find({ status: { $ne: 'archived' } })
    .select('name workspace status')
    .sort({ workspace: 1, name: 1 })
    .lean();

  const byWs = {};
  for (const p of projects) {
    const w = (p.workspace || 'GENERAL').toUpperCase().trim();
    if (!byWs[w]) byWs[w] = [];
    byWs[w].push(p.name);
  }

  const ordered = workspaces.length
    ? workspaces.map((w) => w.name)
    : Object.keys(byWs).sort();

  const seen = new Set();
  for (const w of ordered) {
    seen.add(w);
    console.log(`WORKSPACE: ${w}`);
    const list = byWs[w] || [];
    if (!list.length) console.log('  (no projects)');
    else list.forEach((n) => console.log(`  - ${n}`));
    console.log('');
  }

  for (const w of Object.keys(byWs).sort()) {
    if (seen.has(w)) continue;
    console.log(`WORKSPACE: ${w}`);
    byWs[w].forEach((n) => console.log(`  - ${n}`));
    console.log('');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

// Usage: node scripts/dumpWorkspacesProjects.js > ../docs/workspaces_projects.txt
