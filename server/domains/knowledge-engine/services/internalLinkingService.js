const SITE_BASE = process.env.TSC_SITE_BASE_URL || 'https://theshakticollective.in';

const DEFAULT_TARGETS = [
  { url: `${SITE_BASE}/artist-path`, anchor: 'The Artist Path' },
  { url: `${SITE_BASE}/tscacademy`, anchor: 'TSC Academy' },
  { url: `${SITE_BASE}/book-a-call`, anchor: 'book a call with TSC' },
  { url: `${SITE_BASE}/resources`, anchor: 'artist resources' },
  { url: `${SITE_BASE}/about`, anchor: 'About The Shakti Collective' },
];

function applyInternalLinks(markdown, briefTargets = []) {
  let result = String(markdown || '');
  const targets = [
    ...briefTargets.map((t) => ({ url: t.url, anchor: t.anchor || t.url })),
    ...DEFAULT_TARGETS,
  ];
  const seen = new Set();
  for (const target of targets) {
    if (!target.url || !target.anchor || seen.has(target.url)) continue;
    const anchor = target.anchor;
    const regex = new RegExp(`\\b(${escapeRegex(anchor)})\\b(?!\\])`, 'i');
    if (regex.test(result) && !result.includes(`](${target.url})`)) {
      result = result.replace(regex, `[$1](${target.url})`);
      seen.add(target.url);
    }
  }
  return result;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { applyInternalLinks, DEFAULT_TARGETS };
