const WEIGHT_LABEL = { heavy: 'Heavy', medium: 'Medium', light: 'Light' };

/** Plain-text block matching QA Lighthouse paste format */
export function formatLighthouseReportPlain(report) {
  if (!report?.pages?.length) return '';

  const lines = [];
  if (report.baseUrl) {
    lines.push(`Base URL: ${report.baseUrl}`);
  }
  if (report.generatedAt) {
    lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  }
  if (lines.length) lines.push('');

  for (const page of report.pages) {
    lines.push(page.name || page.path);
    lines.push(page.path);
    if (page.error) {
      lines.push(`Error: ${page.error}`);
    } else {
      lines.push(WEIGHT_LABEL[page.weight] || page.weight || '—');
      lines.push(`Perf ${page.performance ?? '—'}`);
      lines.push(`A11y ${page.accessibility ?? '—'}`);
      const timing = [
        page.fcpDisplay ? `FCP ${page.fcpDisplay}` : '',
        page.lcpDisplay ? `LCP ${page.lcpDisplay}` : '',
        page.unusedKiB ? `~${page.unusedKiB} KiB unused JS` : '',
      ].filter(Boolean).join(' · ');
      if (timing) lines.push(timing);
      if (page.topIssue?.title) {
        lines.push(page.topIssue.title);
        if (page.topIssue.displayValue) lines.push(page.topIssue.displayValue);
      }
    }
    lines.push('');
  }

  const summary = report.summary;
  if (summary) {
    lines.push(`Summary: ${summary.heavy ?? 0} heavy · ${summary.medium ?? 0} medium · ${summary.light ?? 0} light`);
  }

  return lines.join('\n').trim();
}

/** Markdown table for sharing in docs / tickets */
export function formatLighthouseReportMarkdown(report) {
  if (!report?.pages?.length) return '';

  const meta = [];
  if (report.baseUrl) meta.push(`**Base URL:** \`${report.baseUrl}\``);
  if (report.generatedAt) meta.push(`**Generated:** ${new Date(report.generatedAt).toLocaleString()}`);

  const rows = report.pages.map((p) => {
    if (p.error) {
      return `| ${p.name} | \`${p.path}\` | — | — | error | ${p.error} |`;
    }
    const timing = [p.fcpDisplay, p.lcpDisplay, p.unusedKiB ? `~${p.unusedKiB} KiB unused` : '']
      .filter(Boolean)
      .join(' · ');
    return `| ${p.name} | \`${p.path}\` | ${p.performance ?? '—'} | ${p.accessibility ?? '—'} | ${WEIGHT_LABEL[p.weight] || p.weight || '—'} | ${timing || '—'} |`;
  });

  return [
    '## Lighthouse report',
    '',
    ...meta,
    meta.length ? '' : null,
    '| Page | Route | Perf | A11y | Load | Notes |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...rows,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export async function copyTextToClipboard(text) {
  if (!text?.trim()) throw new Error('Nothing to copy');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}
