const { PostHog } = require('posthog-node');

let client = null;

function getPostHogClient() {
  const apiKey = String(process.env.POSTHOG_PROJECT_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!client) {
    client = new PostHog(apiKey, {
      host: String(process.env.POSTHOG_HOST || 'https://us.i.posthog.com').trim(),
      flushAt: 10,
      flushInterval: 5000,
    });
  }
  return client;
}

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
    properties: {
      email: user.email || undefined,
      name: user.name || undefined,
    },
  });
}

async function shutdownPostHog() {
  if (!client) return;
  await client.shutdown();
  client = null;
}

module.exports = {
  captureServerEvent,
  getPostHogClient,
  identifyServerUser,
  shutdownPostHog,
};
