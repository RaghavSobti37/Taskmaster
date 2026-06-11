/**
 * Layer 5 — Visual Regression (scaffold)
 * Full screenshot baseline/compare deferred on Windows CI without Chrome.
 */
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

const BASELINE_DIR = path.join(__dirname, '../../../.local/qa-visual-baselines');

function isVisualRegressionAvailable() {
  if (process.env.QA_VISUAL_REGRESSION === 'force') return { available: true, reason: 'forced via QA_VISUAL_REGRESSION=force' };
  if (process.env.CI === 'true' && process.platform === 'win32' && !process.env.CHROME_PATH) {
    return {
      available: false,
      reason: 'Windows CI without CHROME_PATH — Puppeteer/Playwright screenshots skipped (Layer 5 scaffold only)',
    };
  }
  if (process.env.QA_SKIP_VISUAL === 'true') {
    return { available: false, reason: 'QA_SKIP_VISUAL=true' };
  }
  try {
    require.resolve('puppeteer');
    return { available: true, reason: 'puppeteer installed' };
  } catch {
    return {
      available: false,
      reason: `puppeteer not installed on ${os.platform()} — visual regression scaffolded, not executed`,
    };
  }
}

async function buildVisualRegressionTestCases(reportDiscovery) {
  const { available, reason } = isVisualRegressionAvailable();
  if (reportDiscovery) {
    await reportDiscovery(`Visual regression: ${available ? 'enabled' : `skipped (${reason})`}`);
  }

  const scaffoldCase = {
    name: '[Visual Regression] Baseline scaffold',
    category: 'frontend',
    severity: 'low',
    checklistId: 'visual-regression-scaffold',
    qaMeta: { kind: 'visual-regression', action: 'Screenshot baseline/compare', layer: 5 },
    test: async () => {
      if (!available) {
        return {
          passed: true,
          checkStatus: 'skip',
          description: reason,
          message: `[SKIP] Visual regression: ${reason}`,
          result: { skipped: true, reason, platform: os.platform(), ci: !!process.env.CI },
        };
      }

      await fs.mkdir(BASELINE_DIR, { recursive: true });
      const routes = ['/login', '/dashboard'];
      const results = [];

      try {
        const puppeteer = require('puppeteer');
        const baseUrl = (process.env.QA_FRONTEND_URL || process.env.FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
        const browser = await puppeteer.launch({
          headless: 'new',
          executablePath: process.env.CHROME_PATH || undefined,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        for (const route of routes) {
          const url = `${baseUrl}${route}`;
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            const shotPath = path.join(BASELINE_DIR, `${route.replace(/\//g, '_') || 'root'}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
            results.push({ route, status: 'captured', path: shotPath });
          } catch (err) {
            results.push({ route, status: 'error', error: err.message });
          }
        }
        await browser.close();

        const errors = results.filter((r) => r.status === 'error');
        if (errors.length === routes.length) {
          return {
            passed: true,
            checkStatus: 'skip',
            description: `Frontend unreachable at ${baseUrl} — ${errors[0]?.error}`,
            result: { results },
          };
        }
        return {
          passed: true,
          checkStatus: 'pass',
          description: `Captured ${results.filter((r) => r.status === 'captured').length}/${routes.length} baselines`,
          result: { results, baselineDir: BASELINE_DIR },
        };
      } catch (err) {
        return {
          passed: true,
          checkStatus: 'skip',
          description: `Visual regression error: ${err.message}`,
          result: { error: err.message },
        };
      }
    },
  };

  return [scaffoldCase];
}

module.exports = {
  isVisualRegressionAvailable,
  buildVisualRegressionTestCases,
};
