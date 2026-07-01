import { brand } from '../constants/marketingContent';

/** Stable reference for support / log lookup — deterministic from error + capture time. */
export function buildRouteErrorReference(error, capturedAt = Date.now()) {
  const seed = String(error?.message || error?.name || 'unknown');
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(4, '0').slice(0, 6);
  const datePart = new Date(capturedAt).toISOString().slice(0, 10).replace(/-/g, '');
  return `CK-${datePart}-${hex}`.toUpperCase();
}

/** Plain-language summary — not a stack trace. */
export function summarizeRouteError(error) {
  const msg = String(error?.message || '').trim();
  const lower = msg.toLowerCase();

  if (/chunk|loading.*module|dynamically imported|import\(/i.test(msg)) {
    return 'A part of the app failed to load. Refresh usually fixes this.';
  }
  if (/network|fetch|timeout|econnrefused|failed to fetch/i.test(lower)) {
    return 'A network request failed. Check your connection and try again.';
  }
  if (/\b404\b|not found/i.test(lower)) {
    return 'Something this page needed was not found.';
  }
  if (/\b401\b|\b403\b|unauthorized|forbidden/i.test(lower)) {
    return 'You may not have permission to view this content.';
  }
  if (/is not a function|cannot read propert|undefined is not an object/i.test(msg)) {
    return 'This page hit an unexpected error. Refresh to try again.';
  }
  if (msg && msg.length <= 120 && !msg.includes('\n') && !/^error:/i.test(msg)) {
    return msg;
  }
  return 'An unexpected problem stopped this page from loading.';
}

export function buildRouteErrorSupportMailto(errorRef, summary) {
  const email = brand.supportEmail;
  const subject = `CoreKnot error ${errorRef}`;
  const body = [
    'I ran into an error in CoreKnot.',
    '',
    `Reference: ${errorRef}`,
    `Summary: ${summary}`,
    '',
    'What I was doing:',
    '',
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Support-ready clipboard payload — reference plus message and stack. */
export function buildRouteErrorCopyText({ errorRef, summary, error, capturedAt = Date.now() }) {
  const lines = [];
  lines.push(`Timestamp: ${new Date(capturedAt).toISOString()}`);
  if (errorRef) lines.push(`Reference: ${errorRef}`);
  if (summary) lines.push(`Summary: ${summary}`);
  const name = String(error?.name || 'Error').trim();
  const message = String(error?.message || '').trim();
  if (message) lines.push(`Error: ${name}: ${message}`);
  const stack = String(error?.stack || '').trim();
  if (stack) {
    lines.push('', '--- Stack ---', stack);
  }
  return lines.join('\n').trim() || errorRef || 'Unknown error';
}

export async function copyRouteErrorReference(details) {
  const text =
    typeof details === 'string'
      ? details
      : buildRouteErrorCopyText(details);
  const writeText = globalThis.navigator?.clipboard?.writeText;
  if (!writeText) throw new Error('clipboard-unavailable');
  await writeText.call(globalThis.navigator.clipboard, text);
}
