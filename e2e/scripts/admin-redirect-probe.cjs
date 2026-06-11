const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.locator('input[autocomplete="username"]').fill('e2e-dept-editor@test.coreknot.local');
  await page.locator('input[autocomplete="current-password"]').fill('1Million#');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/dashboard/, { timeout: 30000 });

  for (const route of ['/admin', '/admin/users', '/admin/control', '/admin/qa']) {
    await page.goto(`http://localhost:5173${route}`);
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/admin'), { timeout: 8000 });
    } catch {
      /* stayed on admin */
    }
    const pathname = new URL(page.url()).pathname;
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 180);
    console.log(JSON.stringify({ route, pathname, redirected: !pathname.startsWith('/admin'), text }));
  }
  await browser.close();
})();
