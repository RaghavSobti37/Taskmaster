const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const baseDir = path.resolve(__dirname, '..');

async function run() {
  console.log('Connecting to DB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Load Projects
  const Project = require('./models/Project');
  const projects = await Project.find({}).lean();
  console.log('--- Database Projects ---');
  projects.forEach(p => console.log(`- ID: ${p._id}, Name: "${p.name}", Tenant: ${p.tenantId}`));

  // Scan Basecamp Download folders
  const dirs = fs.readdirSync(baseDir).filter(name => name.startsWith('Basecamp Download'));
  console.log('\n--- Basecamp Folders ---');
  for (const d of dirs) {
    const fullPath = path.join(baseDir, d);
    console.log(`\nFolder: ${d}`);
    scanDir(fullPath, 0);
  }

  await mongoose.disconnect();
}

function scanDir(dirPath, depth) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const indent = '  '.repeat(depth);
      if (item.isDirectory()) {
        console.log(`${indent}[DIR] ${item.name}`);
        scanDir(path.join(dirPath, item.name), depth + 1);
      } else {
        if (depth === 0 || item.name.endsWith('.pdf') || item.name.endsWith('.png') || item.name.endsWith('.jpg') || item.name.endsWith('.jpeg')) {
          console.log(`${indent}[FILE] ${item.name} (${fs.statSync(path.join(dirPath, item.name)).size} bytes)`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
