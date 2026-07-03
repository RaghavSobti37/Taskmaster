#!/usr/bin/env node
/**
 * Sync OpenAPI info.version with package.json — CI drift gate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const specPath = join(root, 'server', 'openapi', 'spec.json');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const version = pkg.version || '0.0.0';
const checkOnly = process.argv.includes('--check');

if (spec.info?.version !== version) {
  if (checkOnly) {
    console.error(`OpenAPI version drift: spec=${spec.info?.version} package=${version}`);
    process.exit(1);
  }
  spec.info.version = version;
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`Updated OpenAPI version → ${version}`);
} else if (checkOnly) {
  console.log(`OpenAPI version OK (${version})`);
} else {
  console.log(`OpenAPI version already ${version}`);
}
