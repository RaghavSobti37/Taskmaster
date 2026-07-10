import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

execSync('node build.mjs', { cwd: __dirname });
const css = fs.readFileSync(path.join(__dirname, 'dist/tokens.css'), 'utf8');

assert.match(css, /--color-brand-primary: #126d5e;/);
assert.match(css, /--spacing-touch-target-min: 44px;/);
