#!/usr/bin/env node
/**
 * Production login diagnostic — captures Clerk + CoreKnot network and page state.
 * Usage: E2E_EMAIL=... E2E_PASSWORD=... node e2e/debug-production-login.mjs
 */
import { chromium } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const AUTH_URL = process.env.E2E_AUTH_ORIGIN || 'https://auth.tsccoreknot.com';

if (!email || !password) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD');
  process.exit(1);
}

const interesting = (url) =>
  url.includes('/api/auth')
  || url.includes('__clerk')
  || url.includes('sign_ins')
  || url.includes('attempt')
  || url.includes('sessions')
  || url.includes('organization');

const events = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    events.push(`CONSOLE ${msg.type()}: ${msg.text()}`);
  }
});

page.on('response', async (res) => {
  const url = res.url();
  if (!interesting(url)) return;
  let body = '';
  try {
    body = (await res.text()).slice(0, 500);
  } catch {
    body = '';
  }
  events.push(`${res.status()} ${res.request().method()} ${url}\n  ${body.replace(/\s+/g, ' ').trim()}`);
});

page.on('requestfailed', (req) => {
  const url = req.url();
  if (!interesting(url)) return;
  events.push(`FAILED ${req.method()} ${url} — ${req.failure()?.errorText || 'unknown'}`);
});

console.log('=== STEP 1: Load login ===');
await page.goto(`${AUTH_URL}/login`, { waitUntil: 'domcontentloaded' });
try {
  await page.getByRole('button', { name: /^accept all$/i }).click({ timeout: 3000 });
} catch {
  /* optional */
}

await page.locator('input[name="identifier"], input[type="email"]').first().waitFor({ timeout: 60_000 });

console.log('=== STEP 2: Submit credentials ===');
await page.locator('input[name="identifier"], input[type="email"]').first().fill(email);

const passwordField = page.locator('input[name="password"], input[type="password"]').first();
const passwordVisible = await passwordField.isVisible().catch(() => false);
if (!passwordVisible) {
  await page.locator('button.cl-formButtonPrimary, .cl-formButtonPrimary').first().click();
  await passwordField.waitFor({ state: 'visible', timeout: 30_000 });
}
await passwordField.fill(password);
await page.locator('button.cl-formButtonPrimary, .cl-formButtonPrimary').last().click();

console.log('=== STEP 3: Wait 45s for Clerk + establish ===');
for (let i = 0; i < 15; i += 1) {
  await page.waitForTimeout(3000);
  const url = page.url();
  const signInVisible = await page.locator('[data-clerk-sign-in-shell] input[name="identifier"]').isVisible().catch(() => false);
  const bootVisible = await page.getByText(/preparing|loading|workspace/i).first().isVisible().catch(() => false);
  const establishError = await page.getByText(/workspace session failed/i).isVisible().catch(() => false);
  console.log(`  t+${(i + 1) * 3}s url=${url} signInForm=${signInVisible} boot=${bootVisible} establishErr=${establishError}`);
  if (url.includes('tsccoreknot.com') && url.includes('/dashboard')) break;
}

console.log('\n=== FINAL URL ===', page.url());

console.log('\n=== NETWORK (auth + clerk) ===');
console.log(events.join('\n---\n') || '(none captured)');

const hasEstablish = events.some((e) => e.includes('/api/auth/clerk-establish'));
const hasSignIns = events.some((e) => e.includes('sign_ins'));
console.log('\n=== SUMMARY ===');
console.log('sign_ins seen:', hasSignIns);
console.log('clerk-establish seen:', hasEstablish);
console.log('reached dashboard:', page.url().includes('/dashboard'));

await browser.close();
