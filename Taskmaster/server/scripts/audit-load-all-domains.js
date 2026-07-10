#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..');
const domainsDir = path.join(SERVER_ROOT, 'domains');
const failures = [];

function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith('.js')) {
      const rel = './' + path.relative(SERVER_ROOT, full).replace(/\\/g, '/').replace(/\.js$/, '');
      try {
        require(path.join(SERVER_ROOT, rel));
      } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
          failures.push({ file: rel, err: e.message.split('\n').filter(Boolean).slice(0, 3).join(' | ') });
        }
      }
    }
  }
}

walk(domainsDir);

if (failures.length === 0) {
  console.log(`OK: all ${fs.readdirSync(domainsDir, { recursive: true }).filter((f) => f.endsWith('.js')).length} domain modules load without MODULE_NOT_FOUND`);
} else {
  console.log(`FAIL: ${failures.length} module(s)`);
  failures.forEach((f) => console.log(`  ${f.file}\n    ${f.err}`));
  process.exit(1);
}
