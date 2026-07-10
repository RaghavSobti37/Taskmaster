const { postHogPersonPropertiesForUser } = require('../../shared/posthogInternalUsers.cjs');

let client = null;
let initialized = false;

const PRODUCTION_RENDER_SERVICES = new Set(['CoreKnot-api', 'Taskmaster']);

const shouldCapturePostHog = () => {
  if (process.env.NODE_ENV === 'test') return false;
  const override = String(process.env.POSTHOG_CAPTURE || '').trim().toLowerCase();
  if (override === 'false' || override === '0') return false;
  if (override === 'true' || override === '1') return true;
  if (process.env.NODE_ENV !== 'production') return false;
  const service = String(process.env.RENDER_SERVICE_NAME || '').trim();
  return PRODUCTION_RENDER_SERVICES.has(service);
};

const initPostHog = () => {
  const apiKey = process.env.POSTHOG_PROJECT_API_KEY?.trim();
  const host = process.env.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  if (!apiKey || initialized || !shouldCapturePostHog()) return false;

  try {
    const { PostHog } = require('posthog-node');
    client = new PostHog(apiKey, { host, flushAt: 10, flushInterval: 5000 });
    initialized = true;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PostHog] Init skipped:', err.message);
    return false;
  }
};

function getPostHogClient() {
  if (!client) initPostHog();
  return client;
}

const getDistinctId = (req) => {
  const headerId = req?.headers?.['x-posthog-distinct-id'];
  if (headerId) return String(headerId);
  if (req?.user?._id) return String(req.user._id);
  return null;
};

const captureEvent = (req, event, properties = {}) => {
  const ph = getPostHogClient();
  if (!ph) return;
  const distinctId = getDistinctId(req);
  if (!distinctId) return;

  const sessionId = req?.headers?.['x-posthog-session-id'];
  const payload = sessionId ? { ...properties, $session_id: String(sessionId) } : properties;

  try {
    ph.capture({ distinctId, event, properties: payload });
  } catch {
    /* optional */
  }
};

function captureServerEvent(distinctId, event, properties = {}) {
  const ph = getPostHogClient();
  if (!ph || !distinctId || !event) return;
  ph.capture({
    distinctId: String(distinctId),
    event,
    properties,
  });
}

function identifyServerUser(user) {
  const ph = getPostHogClient();
  if (!ph || !user) return;
  const id = String(user._id || user.id || '').trim();
  if (!id) return;
  ph.identify({
    distinctId: id,
    properties: postHogPersonPropertiesForUser(user),
  });
}

const captureException = (error, req, context = {}) => {
  const ph = getPostHogClient();
  if (!ph || !error) return;
  const distinctId = getDistinctId(req) || 'server';

  try {
    ph.captureException(error, distinctId, context);
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
  captureServerEvent,
  getPostHogClient,
  identifyServerUser,
  shutdownPostHog,
  isPostHogEnabled: () => initialized,
};
