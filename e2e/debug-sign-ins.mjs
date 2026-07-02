#!/usr/bin/env node
import { chromium } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async (res) => {
  if (!res.url().includes('sign_ins') && !res.url().includes('attempt_first_factor')) return;
  let text = '';
  try { text = await res.text(); } catch { /* */ }
  console.log(`\n${res.status()} ${res.url().split('?')[0]}`);
  const parsed = JSON.parse(text);
  console.log('status:', parsed?.response?.status || parsed?.status);
  console.log('identifier:', parsed?.response?.identifier);
});

await page.goto('https://auth.tsccoreknot.com/login');
try { await page.getByRole('button', { name: /^accept all$/i }).click({ timeout: 3000 }); } catch { /* */ }

const id = page.locator('input[name="identifier"]').first();
await id.waitFor({ state: 'visible' });
await id.click();
await id.pressSequentially(email, { delay: 30 });
await page.waitForTimeout(500);

const idVal = await id.inputValue();
console.log('identifier input value before continue:', idVal);

const pw = page.locator('input[name="password"]').first();
if (await pw.isVisible().catch(() => false)) {
  // Force identifier-only step: tab to password only after first continue if needed
  console.log('trying Continue with identifier only first');
  await page.locator('button.cl-formButtonPrimary').first().click();
  await page.waitForTimeout(3000);
  const idVal2 = await id.inputValue().catch(() => 'gone');
  console.log('identifier after first continue:', idVal2);
}

if (await pw.isVisible().catch(() => false)) {
  await pw.click();
  await pw.pressSequentially(password, { delay: 30 });
  await page.locator('button.cl-formButtonPrimary').last().click();
} else {
  await pw.waitFor({ state: 'visible', timeout: 15_000 });
  await pw.pressSequentially(password, { delay: 30 });
  await page.locator('button.cl-formButtonPrimary').last().click();
}

await page.waitForTimeout(10_000);
console.log('final url:', page.url());
await browser.close();
