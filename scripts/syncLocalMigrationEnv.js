#!/usr/bin/env node
/**
 * Align local auth + strangler env for Express (:5000) and NestJS (:5001).
 * Does not touch production hosts or Supabase URLs.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_ENV = path.join(ROOT, 'server', '.env');
const NEST_ENV = path.join(ROOT, 'nestjs-server', '.env');
const CLIENT_DEV_ENV = path.join(ROOT, 'client', '.env.development');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function parseKey(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return '';
  return String(match[1] || '').trim().replace(/^["']|["']$/g, '');
}

function upsertKey(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  const trimmed = content.trimEnd();
  return `${trimmed}${trimmed ? '\n' : ''}${line}\n`;
}

function ensureFileFromExample(target, example) {
  if (fs.existsSync(target)) return readEnvFile(target);
  if (!fs.existsSync(example)) return '';
  const content = readEnvFile(example);
  fs.writeFileSync(target, content, 'utf8');
  return content;
}

function main() {
  let serverEnv = ensureFileFromExample(SERVER_ENV, path.join(ROOT, 'server', '.env.example'));
  let nestEnv = ensureFileFromExample(NEST_ENV, path.join(ROOT, 'nestjs-server', '.env.example'));

  const fromServer = parseKey(serverEnv, 'JWT_SECRET');
  const fromNest = parseKey(nestEnv, 'JWT_SECRET');
  const placeholder = /your[-_]?jwt|your_secure_secret|placeholder/i;

  let jwt =
    (fromServer && !placeholder.test(fromServer) && fromServer) ||
    (fromNest && !placeholder.test(fromNest) && fromNest) ||
    crypto.randomBytes(32).toString('hex');

  serverEnv = upsertKey(serverEnv, 'JWT_SECRET', jwt);
  nestEnv = upsertKey(nestEnv, 'JWT_SECRET', jwt);
  nestEnv = upsertKey(
    nestEnv,
    'DATABASE_URL',
    parseKey(nestEnv, 'DATABASE_URL') || 'postgresql://postgres:postgres@localhost:5432/coreknot',
  );
  nestEnv = upsertKey(nestEnv, 'FRONTEND_URL', 'http://localhost:5173');
  nestEnv = upsertKey(nestEnv, 'NODE_ENV', 'development');

  fs.writeFileSync(SERVER_ENV, serverEnv, 'utf8');
  fs.writeFileSync(NEST_ENV, nestEnv, 'utf8');

  let clientDev = readEnvFile(CLIENT_DEV_ENV);
  clientDev = upsertKey(clientDev, 'VITE_NEST_ATTENDANCE', 'true');
  clientDev = upsertKey(clientDev, 'VITE_NEST_TASKS', 'false');
  fs.writeFileSync(CLIENT_DEV_ENV, clientDev, 'utf8');

  console.log('Local migration env synced:');
  console.log('  server/.env           JWT_SECRET aligned');
  console.log('  nestjs-server/.env    JWT_SECRET + DATABASE_URL');
  console.log('  client/.env.development  VITE_NEST_ATTENDANCE=true (tasks stay on Express)');
}

main();
