import { brand } from '../constants/marketingContent';

/** Localized short timestamp for error metadata row. */
export function formatErrorTimestamp(capturedAt = Date.now()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(capturedAt));
}

export function getSystemStatusUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/health`;
  }
  return '/api/health';
}

export function inferStatusCode({ statusCode, summary, error }) {
  if (statusCode) return statusCode;
  const fromError = error?.status || error?.response?.status;
  if (fromError) return fromError;
  const text = `${summary || ''} ${error?.message || ''}`;
  const match = text.match(/\b(401|403|404|408|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

export function resolveAppErrorTitle({ statusCode, summary }) {
  if ([502, 503, 504].includes(statusCode)) return 'Server temporarily unavailable';
  if (statusCode === 404) return 'Page not found';
  if (statusCode === 401 || statusCode === 403) return 'Access denied';
  if (/timed out|taking too long/i.test(String(summary || ''))) return 'Connection timed out';
  return 'Something went wrong';
}

export function shouldShowHealthyServicesBadge({ statusCode, summary }) {
  if ([502, 503, 504].includes(statusCode)) return true;
  return /temporarily unavailable|server did not respond/i.test(String(summary || ''));
}

/** Normalize string or structured boot errors into AppErrorPage props. */
export function resolveAppErrorPresentation({
  summary,
  error = null,
  errorRef = null,
  statusCode = null,
  capturedAt = Date.now(),
  showHealthyBadge,
} = {}) {
  const normalizedError =
    error instanceof Error
      ? error
      : error?.message
        ? new Error(String(error.message))
        : summary
          ? new Error(String(summary))
          : null;

  const resolvedSummary =
    String(summary || '').trim()
    || (normalizedError ? summarizeRouteError(normalizedError) : '')
    || 'An unexpected problem stopped this page from loading.';

  const resolvedStatus = inferStatusCode({
    statusCode,
    summary: resolvedSummary,
    error: normalizedError,
  });
  const resolvedRef =
    errorRef || buildRouteErrorReference(normalizedError || new Error(resolvedSummary), capturedAt);

  return {
    title: resolveAppErrorTitle({ statusCode: resolvedStatus, summary: resolvedSummary }),
    summary: resolvedSummary,
    error: normalizedError,
    errorRef: resolvedRef,
    statusCode: resolvedStatus,
    capturedAt,
    showHealthyBadge:
      typeof showHealthyBadge === 'boolean'
        ? showHealthyBadge
        : shouldShowHealthyServicesBadge({ statusCode: resolvedStatus, summary: resolvedSummary }),
  };
}

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
