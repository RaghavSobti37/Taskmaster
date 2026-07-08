const path = require('path');

const SEGMENT_SUFFIX_RE = /\s*(failed audience|failed|delivered audience|delivered|read audience|read|clicked audience|clicked|click audience|replied audience|replied|sent audience|sent)\s*/gi;

function normalizeCampaignBaseName(name = '') {
  return String(name)
    .replace(/\.csv$/i, '')
    .replace(SEGMENT_SUFFIX_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferStatusFromSegmentName(name = '') {
  const lower = String(name).toLowerCase();
  if (lower.includes('failed audience') || /\bfailed\b/.test(lower)) return 'failed';
  if (lower.includes('clicked audience') || lower.includes('click')) return 'clicked';
  if (lower.includes('read audience') || /\bread\b/.test(lower)) return 'read';
  if (lower.includes('delivered audience') || lower.includes('deliver')) return 'delivered';
  if (lower.includes('replied')) return 'replied';
  if (lower.includes('sent audience')) return 'sent';
  return null;
}

function inferStatusFromFilename(filename = '') {
  const fromName = inferStatusFromSegmentName(filename);
  if (fromName) return fromName;
  const lower = String(filename).toLowerCase();
  if (lower.includes('failed')) return 'failed';
  if (lower.includes('delivered')) return 'delivered';
  if (lower.includes('read')) return 'read';
  if (lower.includes('click')) return 'clicked';
  if (lower.includes('repl')) return 'replied';
  return 'sent';
}

function inferCampaignNameFromFilename(filename = '') {
  return normalizeCampaignBaseName(path.basename(filename, path.extname(filename)));
}

module.exports = {
  SEGMENT_SUFFIX_RE,
  normalizeCampaignBaseName,
  inferStatusFromSegmentName,
  inferStatusFromFilename,
  inferCampaignNameFromFilename,
};
