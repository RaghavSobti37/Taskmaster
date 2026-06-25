let client = null;
let initialized = false;

const initPostHog = () => {
  const apiKey = process.env.POSTHOG_PROJECT_API_KEY?.trim();
  const host = process.env.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  if (!apiKey || initialized || process.env.NODE_ENV === 'test') return false;

  try {
    const { PostHog } = require('posthog-node');
    client = new PostHog(apiKey, { host });
    initialized = true;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PostHog] Init skipped:', err.message);
    return false;
  }
};

const getDistinctId = (req) => {
  const headerId = req?.headers?.['x-posthog-distinct-id'];
  if (headerId) return String(headerId);
  if (req?.user?._id) return String(req.user._id);
  return null;
};

const captureEvent = (req, event, properties = {}) => {
  if (!client) return;
  const distinctId = getDistinctId(req);
  if (!distinctId) return;

  const sessionId = req?.headers?.['x-posthog-session-id'];
  const payload = sessionId ? { ...properties, $session_id: String(sessionId) } : properties;

  try {
    client.capture({
      distinctId,
      event,
      properties: payload,
    });
  } catch {
    /* optional */
  }
};

const captureException = (error, req, context = {}) => {
  if (!client || !error) return;
  const distinctId = getDistinctId(req) || 'server';

  try {
    client.captureException(error, distinctId, context);
  } catch {
    /* optional */
  }
};

const shutdownPostHog = async () => {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    /* optional */
  } finally {
    client = null;
    initialized = false;
  }
};

module.exports = {
  initPostHog,
  captureEvent,
  captureException,
  shutdownPostHog,
  isPostHogEnabled: () => initialized,
};
