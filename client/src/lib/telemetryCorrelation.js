/** Extends client telemetry with correlation ID for distributed tracing. */
import { getPostHogClient } from './posthog';

let correlationId = null;

export function getCorrelationId() {
  if (correlationId) return correlationId;
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  correlationId = Array.from(bytes, (d) => d.toString(16)).join('-');
  return correlationId;
}

export function attachCorrelationId(headers = {}) {
  return {
    ...headers,
    'x-correlation-id': getCorrelationId(),
  };
}

export function initTelemetryCorrelation() {
  const id = getCorrelationId();
  const ph = getPostHogClient();
  ph?.register?.({ correlation_id: id });

  if (typeof window !== 'undefined') {
    window.addEventListener('coreknot-sw-error', (event) => {
      ph?.capture?.('sw_runtime_error', {
        message: event.detail?.message,
        correlation_id: id,
      });
    });
  }
}
