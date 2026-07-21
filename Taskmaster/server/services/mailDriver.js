/**
 * CoreKnot no longer owns email delivery.
 * Transactional messages are delegated to Auto-Mailer so provider logic,
 * sender configuration, and delivery telemetry live in one service.
 */

const MAX_TRANSACTIONAL_RECIPIENTS = 50;

function normalizeToList(to) {
  if (!to) return [];
  const list = Array.isArray(to) ? to : String(to).split(/[,;]/);
  const seen = new Set();
  return list
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e && /[^\s@]+@[^\s@]+/.test(e) && !seen.has(e) && seen.add(e));
}

/**
 * Auto-Mailer is a standalone service. CoreKnot references it via
 * AUTO_MAILER_API_URL — if unset, email dispatch degrades gracefully.
 * @see Auto-Mailer repo
 */
function resolveAutoMailerApiBase() {
  const raw = String(process.env.AUTO_MAILER_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return { error: 'AUTO_MAILER_API_URL is not configured. Set it to your Auto-Mailer API origin (e.g. the Render URL of your automailer-api service).' };
  if (/vercel\.app$/i.test(raw) || /auto-mailer-blue/i.test(raw)) {
    return { error: 'AUTO_MAILER_API_URL must be the Auto-Mailer API origin (e.g. your automailer-api Render URL), not the Vercel UI' };
  }
  return { baseUrl: raw };
}

function resolveBridgeToken() {
  const token = process.env.AUTO_MAILER_INTERNAL_TOKEN || process.env.COREKNOT_MAIL_BRIDGE_SECRET;
  if (!token) return { error: 'AUTO_MAILER_INTERNAL_TOKEN or COREKNOT_MAIL_BRIDGE_SECRET is not configured' };
  return { token };
}

async function dispatchEmailPayload({ to, cc, subject, html, from } = {}) {
  const recipients = normalizeToList(to);
  if (!recipients.length) return { error: 'No valid recipients' };
  if (recipients.length > MAX_TRANSACTIONAL_RECIPIENTS) {
    return { error: `Transactional email is limited to ${MAX_TRANSACTIONAL_RECIPIENTS} recipients` };
  }
  const { baseUrl, error: baseUrlError } = resolveAutoMailerApiBase();
  if (baseUrlError) return { error: baseUrlError };

  const { token, error: tokenError } = resolveBridgeToken();
  if (tokenError) return { error: tokenError };

  const headers = { 'Content-Type': 'application/json' };
  headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${baseUrl}/api/transactional/send`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        to: recipients,
        cc: normalizeToList(cc),
        subject,
        html,
        from,
        source: 'coreknot',
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: body.error || `Auto-Mailer returned ${response.status}`, status: response.status };
    }
    return body;
  } catch (err) {
    return { error: err.message };
  }
}

function assertEmailDispatchSucceeded(result, context = 'Email dispatch') {
  if (result?.error) {
    const err = new Error(`${context}: ${result.error}`);
    if (result.status) err.status = result.status;
    if (result.provider) err.provider = result.provider;
    throw err;
  }
  return result;
}

module.exports = {
  assertEmailDispatchSucceeded,
  dispatchEmailPayload,
  normalizeToList,
  resolveAutoMailerApiBase,
  resolveBridgeToken,
  limits: {
    MAX_TRANSACTIONAL_RECIPIENTS,
  },
};
