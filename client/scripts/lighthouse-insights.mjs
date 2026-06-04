/**
 * Extract performance + accessibility diagnostics from Lighthouse LHR JSON.
 */

const CORE_METRICS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
  'interactive',
];

const OPPORTUNITY_AUDIT_IDS = new Set([
  'unused-javascript',
  'unused-css-rules',
  'render-blocking-resources',
  'uses-rel-preconnect',
  'uses-rel-preload',
  'offscreen-images',
  'modern-image-formats',
  'uses-optimized-images',
  'uses-text-compression',
  'uses-responsive-images',
  'efficient-animated-content',
  'duplicated-javascript',
  'legacy-javascript',
  'unminified-javascript',
  'unminified-css',
  'mainthread-work-breakdown',
  'bootup-time',
  'third-party-summary',
  'network-rtt',
  'network-server-latency',
  'total-byte-weight',
  'dom-size',
]);

function auditInCategory(lhr, auditId, categoryId) {
  const refs = lhr.categories?.[categoryId]?.auditRefs || [];
  return refs.some((r) => r.id === auditId);
}

export function extractPageInsights(lhr) {
  const audits = lhr.audits || {};

  const metrics = {};
  for (const id of CORE_METRICS) {
    const a = audits[id];
    if (!a) continue;
    metrics[id] = {
      displayValue: a.displayValue,
      numericValue: a.numericValue,
      score: a.score,
    };
  }

  const opportunities = Object.entries(audits)
    .filter(([id, a]) => {
      if (a.score === null || a.score >= 0.9) return false;
      if (a.details?.type === 'opportunity') return true;
      if (OPPORTUNITY_AUDIT_IDS.has(id)) return true;
      return a.details?.overallSavingsMs > 0 || a.details?.overallSavingsBytes > 0;
    })
    .map(([id, a]) => ({
      id,
      title: a.title,
      description: a.description,
      displayValue: a.displayValue,
      numericValue: a.numericValue,
      score: a.score,
      savingsMs: a.details?.overallSavingsMs ?? a.numericValue ?? 0,
      savingsBytes: a.details?.overallSavingsBytes ?? 0,
    }))
    .sort((a, b) => (b.savingsMs || 0) - (a.savingsMs || 0) || (b.savingsBytes || 0) - (a.savingsBytes || 0))
    .slice(0, 12);

  const accessibilityFailures = Object.entries(audits)
    .filter(([id, a]) => {
      if (!auditInCategory(lhr, id, 'accessibility')) return false;
      return a.score !== null && a.score < 1;
    })
    .map(([id, a]) => ({
      id,
      title: a.title,
      description: a.description,
      displayValue: a.displayValue,
      score: a.score,
    }))
    .slice(0, 15);

  const diagnostics = Object.entries(audits)
    .filter(([id, a]) => {
      if (!auditInCategory(lhr, id, 'performance')) return false;
      if (a.score === null) return false;
      if (CORE_METRICS.includes(id)) return false;
      return a.score < 1 && a.details?.type !== 'opportunity';
    })
    .map(([id, a]) => ({
      id,
      title: a.title,
      displayValue: a.displayValue,
      description: a.description,
    }))
    .slice(0, 8);

  return {
    finalUrl: lhr.finalUrl,
    fetchTime: lhr.fetchTime,
    metrics,
    opportunities,
    accessibilityFailures,
    diagnostics,
  };
}

export function buildPerformanceMarkdown(rows, meta) {
  const lines = [
    '# Lighthouse performance & accessibility — detailed report',
    '',
    `**Base URL:** ${meta.baseUrl}`,
    `**Generated:** ${meta.generatedAt}`,
    `**Routes:** ${rows.length}`,
    '',
    '## Score summary (all pages)',
    '',
    '| Page | Route | Perf | A11y | Top slowdown |',
    '| --- | --- | ---: | ---: | --- |',
  ];

  for (const r of rows) {
    const top = r.insights?.opportunities?.[0];
    const slow = top ? `${top.title}${top.displayValue ? ` (${top.displayValue})` : ''}` : '—';
    lines.push(
      `| ${r.name} | \`${r.path}\` | ${r.scores.performance ?? '—'} | ${r.scores.accessibility ?? '—'} | ${slow.replace(/\|/g, '/')} |`
    );
  }

  lines.push('', '---', '', '## Per-page breakdown', '');

  for (const r of rows) {
    lines.push(`### ${r.name} (\`${r.path}\`)`, '');
    if (r.error) {
      lines.push(`**Audit failed:** ${r.error}`, '');
      continue;
    }

    lines.push(
      `| Category | Score |`,
      `| --- | ---: |`,
      `| Performance | ${r.scores.performance ?? '—'} |`,
      `| Accessibility | ${r.scores.accessibility ?? '—'} |`,
      `| Best practices | ${r.scores['best-practices'] ?? '—'} |`,
      `| SEO | ${r.scores.seo ?? '—'} |`,
      ''
    );

    const m = r.insights?.metrics || {};
    if (Object.keys(m).length) {
      lines.push('**Core Web Vitals / timing:**', '');
      for (const id of CORE_METRICS) {
        if (!m[id]) continue;
        lines.push(`- **${id}:** ${m[id].displayValue || m[id].numericValue}`);
      }
      lines.push('');
    }

    const opps = r.insights?.opportunities || [];
    if (opps.length) {
      lines.push('**What is slowing this page down:**', '');
      for (const o of opps) {
        lines.push(`1. **${o.title}** — ${o.displayValue || 'see Lighthouse HTML'}`);
        if (o.description) {
          const short = o.description.replace(/\s+/g, ' ').slice(0, 220);
          lines.push(`   - ${short}${o.description.length > 220 ? '…' : ''}`);
        }
      }
      lines.push('');
    }

    const a11 = r.insights?.accessibilityFailures || [];
    if (a11.length) {
      lines.push('**Accessibility issues:**', '');
      for (const a of a11) {
        lines.push(`- **${a.title}**${a.displayValue ? ` (${a.displayValue})` : ''}`);
      }
      lines.push('');
    }

    const diag = r.insights?.diagnostics || [];
    if (diag.length) {
      lines.push('**Other performance diagnostics:**', '');
      for (const d of diag) {
        lines.push(`- ${d.title}${d.displayValue ? `: ${d.displayValue}` : ''}`);
      }
      lines.push('');
    }
  }

  lines.push(
    '---',
    '',
    '## Cross-cutting themes',
    '',
    'Protected app routes share one JS bundle; scores cluster when the shell loads the same chunks. Typical wins:',
    '',
    '- **unused-javascript** — code-split heavy routes (charts, email editor, workflow canvas) and defer below-the-fold widgets.',
    '- **uses-rel-preconnect** — preconnect API origin used on first paint.',
    '- **render-blocking-resources** — ensure critical CSS inlined or loaded async in production build.',
    '- **LCP ~3.4–3.9s** on dashboard — stagger non-critical React Query fetches (already partially done in v1.9.10).',
    '',
    'Re-run: `npm run build && npm run preview` then `LH_BASE_URL=http://localhost:4173 npm run lighthouse -- --prod`',
    ''
  );

  return lines.join('\n');
}

export function buildDetailsHtml(rows, meta) {
  const sections = rows
    .map((r) => {
      if (r.error) {
        return `<section class="page"><h2>${r.name} <code>${r.path}</code></h2><p class="err">${r.error}</p></section>`;
      }
      const opps = (r.insights?.opportunities || [])
        .map(
          (o) =>
            `<li><strong>${o.title}</strong>${o.displayValue ? ` — ${o.displayValue}` : ''}</li>`
        )
        .join('');
      const a11 = (r.insights?.accessibilityFailures || [])
        .map((a) => `<li><strong>${a.title}</strong>${a.displayValue ? ` — ${a.displayValue}` : ''}</li>`)
        .join('');
      const metrics = CORE_METRICS.filter((id) => r.insights?.metrics?.[id])
        .map((id) => {
          const m = r.insights.metrics[id];
          return `<li>${id}: ${m.displayValue || m.numericValue}</li>`;
        })
        .join('');
      return `<section class="page" id="${r.slug}">
  <h2><a href="./pages/${r.slug}.report.html">${r.name}</a> <code>${r.path}</code></h2>
  <p>Perf <span class="score">${r.scores.performance}</span> · A11y <span class="score">${r.scores.accessibility}</span></p>
  ${metrics ? `<h3>Timing</h3><ul>${metrics}</ul>` : ''}
  ${opps ? `<h3>Slowdowns</h3><ol>${opps}</ol>` : '<p class="muted">No major opportunities flagged.</p>'}
  ${a11 ? `<h3>Accessibility</h3><ul>${a11}</ul>` : ''}
</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Lighthouse — performance details</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 960px; color: #111; }
    h1 { font-size: 1.4rem; }
    .meta { color: #555; font-size: 0.9rem; }
    section.page { border-top: 1px solid #eee; padding: 1.25rem 0; }
    h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.35rem; color: #333; }
    code { font-size: 0.85rem; color: #666; }
    .score { font-weight: 600; }
    .err { color: #b00020; }
    .muted { color: #888; font-size: 0.9rem; }
    a { color: #126d5e; }
    ol, ul { margin: 0.25rem 0 0 1.25rem; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Lighthouse — what is slowing each page</h1>
  <p class="meta">Base: <strong>${meta.baseUrl}</strong> · ${meta.generatedAt} · <a href="./index.html">Score table</a> · <a href="./PERFORMANCE_REPORT.md">Markdown report</a></p>
  ${sections}
</body>
</html>`;
}
