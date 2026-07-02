// @ts-check
import { test, expect } from '@playwright/test';

const AUTH_ORIGIN = process.env.E2E_AUTH_ORIGIN || 'https://auth.tsccoreknot.com';
const MAX_JS_ASSETS = Number(process.env.AUTH_LOGIN_MAX_JS_ASSETS || 40);
const SETTLE_MS = Number(process.env.AUTH_LOGIN_SETTLE_MS || 15_000);

test.describe('auth login network budget', () => {
  test.describe.configure({ timeout: 180_000 });

  test('auth host does not publish a service worker script', async ({ request }) => {
    test.skip(process.env.E2E_PRODUCTION_AUTH !== '1', 'Set E2E_PRODUCTION_AUTH=1');
    const res = await request.get(`${AUTH_ORIGIN}/sw.js`);
    expect(res.status(), 'slim auth build must not ship sw.js').toBe(404);
  });

  test('login stays under JS asset budget while service worker settles', async ({ page }) => {
    test.skip(process.env.E2E_PRODUCTION_AUTH !== '1', 'Set E2E_PRODUCTION_AUTH=1');

    const jsAssets = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\/assets\/.*\.js(?:\?|$)/i.test(url)) jsAssets.push(url);
    });

    await page.goto(`${AUTH_ORIGIN}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(SETTLE_MS);

    const swRegistrations = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return 0;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length;
    });

    expect(swRegistrations, 'auth host should not keep a service worker after slim build').toBe(0);
    expect(
      jsAssets.length,
      `too many JS assets on login (${jsAssets.length} > ${MAX_JS_ASSETS}); sample: ${jsAssets.slice(0, 5).join(', ')}`,
    ).toBeLessThanOrEqual(MAX_JS_ASSETS);
  });
});
