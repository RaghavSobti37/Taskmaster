#!/usr/bin/env node
/** Find Taskmaster root from Vercel cwd (repo root or sites/*). */
const fs = require('fs');
const path = require('path');

function findTaskmasterRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'client', 'scripts', 'generateVercelConfig.cjs'))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, 'Taskmaster', 'client', 'scripts', 'generateVercelConfig.cjs'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Taskmaster root not found from ' + process.cwd());
}

module.exports = { findTaskmasterRoot };
