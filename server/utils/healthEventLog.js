/** Recent dependency / boot events for health dashboard. */
const MAX = 24;
const events = [];

function pushEvent(level, message) {
  events.unshift({
    at: new Date().toISOString(),
    level,
    message,
  });
  if (events.length > MAX) events.length = MAX;
}

function getRecent(limit = 8) {
  return events.slice(0, limit);
}

function seedBootEvent() {
  pushEvent('ok', 'API Boot Completed');
}

const lastProbeStates = {};

/** Log dependency transitions once — avoids spam on dashboard refresh. */
function syncProbeEvents(probe) {
  for (const svc of probe?.services || []) {
    const stateKey = `${svc.status}:${svc.state}:${svc.error || ''}`;
    if (lastProbeStates[svc.id] === stateKey) continue;
    lastProbeStates[svc.id] = stateKey;
    const level = svc.status === 'ok' ? 'ok' : svc.status === 'degraded' ? 'warn' : 'bad';
    const latency = svc.latencyMs != null ? ` · ${svc.latencyMs} ms` : '';
    const err = svc.error ? ` — ${svc.error}` : '';
    pushEvent(level, `${svc.label} ${svc.state}${latency}${err}`);
  }
}

module.exports = { pushEvent, getRecent, seedBootEvent, syncProbeEvents };
