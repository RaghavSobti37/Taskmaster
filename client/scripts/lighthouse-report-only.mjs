#!/usr/bin/env node
/**
 * Rebuild PERFORMANCE_REPORT.md + performance-details.html from existing pages/*.report.json
 * without re-running Chrome/Lighthouse.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractPageInsights,
  buildPerformanceMarkdown,
  buildDetailsHtml,
} from './lighthouse-insights.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../lighthouse-reports');
const PAGES_DIR = path.join(OUTPUT_DIR, 'pages');

function slugify(routePath) {
  if (routePath === '/') return 'home';
  return routePath.replace(/^\//, '').replace(/[/:]/g, '_') || 'root';
}

async function main() {
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  let summary;
  try {
    summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
  } catch {
    console.error('No summary.json — run npm run lighthouse first');
    process.exit(1);
  }

  const rows = [];
  for (const route of summary.routes) {
    const slug = slugify(route.path);
    const jsonPath = path.join(PAGES_DIR, `${slug}.report.json`);
    let insights = null;
    try {
      const lhr = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
      insights = extractPageInsights(lhr);
    } catch {
      /* missing json */
    }
    rows.push({ ...route, slug, insights });
  }

  const meta = {
    baseUrl: summary.baseUrl,
    generatedAt: new Date().toISOString(),
    auth: summary.auth,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, 'PERFORMANCE_REPORT.md'), buildPerformanceMarkdown(rows, meta), 'utf8');
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'performance-details.json'),
    JSON.stringify({ ...summary, generatedAt: meta.generatedAt, routes: rows }, null, 2),
    'utf8'
  );
  await fs.writeFile(path.join(OUTPUT_DIR, 'performance-details.html'), buildDetailsHtml(rows, meta), 'utf8');
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'PERFORMANCE_REPORT.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
