// @ts-check
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test as base, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(E2E_ROOT, '..');
const AUTH_DIR = path.join(E2E_ROOT, '.auth');

const MANIFEST_PATHS = [
  path.join(REPO_ROOT, '.agents', 'e2e-users.json'),
  path.join(__dirname, 'e2e-users.default.json'),
];

/** @typedef {{ archetype: string, email: string, password: string, description?: string, department?: { slug?: string, name?: string, pagePermissions?: string[] }, pagePermissions?: string[] }} E2EUser */

/**
 * @returns {{ defaultPassword: string, users: Array<Record<string, unknown>> }}
 */
function readManifest() {
  for (const manifestPath of MANIFEST_PATHS) {
    if (!fs.existsSync(manifestPath)) continue;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  throw new Error(
    `No E2E user manifest found. Create ${MANIFEST_PATHS[0]} or keep ${MANIFEST_PATHS[1]}`,
  );
}

/**
 * @param {Record<string, unknown>} entry
 * @param {string} defaultPassword
 * @returns {E2EUser | null}
 */
function resolveUser(entry, defaultPassword) {
  const archetype = String(entry.archetype || '').trim();
  if (!archetype) return null;

  const emailEnv = entry.emailEnv ? String(entry.emailEnv) : '';
  const email =
    (emailEnv && process.env[emailEnv]) ||
    (entry.email ? String(entry.email) : '') ||
    (archetype === 'admin' ? process.env.E2E_EMAIL || '' : '');

  if (!email) return null;

  const password =
    (entry.password ? String(entry.password) : '') ||
    process.env.E2E_PASSWORD ||
    defaultPassword;

  const department = entry.department && typeof entry.department === 'object'
    ? entry.department
    : undefined;

  return {
    archetype,
    email,
    password,
    description: entry.description ? String(entry.description) : undefined,
    department,
    pagePermissions: Array.isArray(department?.pagePermissions)
      ? department.pagePermissions
      : Array.isArray(entry.pagePermissions)
        ? entry.pagePermissions
        : undefined,
  };
}

/** @returns {E2EUser[]} */
export function getE2EUsers() {
  const manifest = readManifest();
  const defaultPassword = String(
    manifest.defaultPassword || manifest.password || process.env.E2E_PASSWORD || '1Million#',
  );

  return manifest.users
    .map((entry) => resolveUser(entry, defaultPassword))
    .filter(Boolean);
}

export function ensureAuthDir() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/** @param {string} archetype */
export function storageStatePath(archetype) {
  return path.join(AUTH_DIR, `${archetype}.json`);
}

/** @param {string} archetype */
export function hasStorageState(archetype) {
  return fs.existsSync(storageStatePath(archetype));
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {E2EUser} user
 */
export async function loginUser(page, user) {
  await login(page, { email: user.email, password: user.password });
}

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {E2EUser} user
 */
export async function saveStorageState(context, user) {
  ensureAuthDir();
  await context.storageState({ path: storageStatePath(user.archetype) });
}

export const test = base.extend({
  /** @type {import('@playwright/test').Fixtures & { e2eUser: E2EUser }} */
  e2eUser: async ({}, use, testInfo) => {
    const archetype = testInfo.project.name;
    const user = getE2EUsers().find((entry) => entry.archetype === archetype);
    if (!user) {
      throw new Error(`No E2E user configured for project "${archetype}"`);
    }
    await use(user);
  },
});

export { expect };
