#!/usr/bin/env node
/** One-time: append MONGODB_URI_STAGING to server/.env.render from MONGODB_URI_PROD */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', '.env.render');
if (!fs.existsSync(file)) {
  console.error('Missing server/.env.render');
  process.exit(1);
}
let text = fs.readFileSync(file, 'utf8');
if (/^MONGODB_URI_STAGING=/m.test(text)) {
  console.log('MONGODB_URI_STAGING already present');
  process.exit(0);
}
const match = text.match(/^MONGODB_URI_PROD=(.+)$/m);
if (!match) {
  console.error('MONGODB_URI_PROD missing from .env.render');
  process.exit(1);
}
const prod = match[1].trim().replace(/^["']|["']$/g, '');
const staging = prod
  .replace(/\/taskmaster_production(\?|$)/i, '/taskmaster_staging$1')
  .replace(/\/taskmaster_local(\?|$)/i, '/taskmaster_staging$1');
if (!staging.includes('taskmaster_staging')) {
  console.error('Could not derive taskmaster_staging URI from MONGODB_URI_PROD');
  process.exit(1);
}
fs.appendFileSync(file, `\nMONGODB_URI_STAGING=${staging}\n`);
console.log('Appended MONGODB_URI_STAGING to server/.env.render');
