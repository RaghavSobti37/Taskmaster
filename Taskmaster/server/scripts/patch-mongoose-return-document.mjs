#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = path.join(import.meta.dirname, '..');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (name.endsWith('.js')) {
      const text = fs.readFileSync(full, 'utf8');
      const next = text.replace(/\bnew:\s*true\b/g, "returnDocument: 'after'");
      if (next !== text) {
        fs.writeFileSync(full, next);
        console.log(path.relative(root, full));
      }
    }
  }
}

walk(root);
