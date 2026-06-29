/**
 * Render Dashboard log deep links (stdout / Pino → Render log store).
 * Set service IDs or full log URLs via VITE_* in Vercel / local client/.env.
 */

const trim = (value) => String(value || '').trim();

export const RENDER_LOG_TARGET_DEFS = [
  {
    id: 'production-api',
    label: 'Production API',
    serviceName: 'Taskmaster',
    serviceIdEnv: 'VITE_RENDER_SERVICE_ID_PRODUCTION',
    urlEnv: 'VITE_RENDER_LOGS_PRODUCTION_URL',
  },
  {
    id: 'staging-api',
    label: 'Staging API',
    serviceName: 'coreknot-api-staging',
    serviceIdEnv: 'VITE_RENDER_SERVICE_ID_STAGING_API',
    urlEnv: 'VITE_RENDER_LOGS_STAGING_API_URL',
  },
  {
    id: 'staging-nest',
    label: 'Nest Staging',
    serviceName: 'coreknot-nest-staging',
    serviceIdEnv: 'VITE_RENDER_SERVICE_ID_STAGING_NEST',
    urlEnv: 'VITE_RENDER_LOGS_STAGING_NEST_URL',
  },
];

export function renderServiceLogsUrl(serviceId) {
  const id = trim(serviceId);
  if (!id) return null;
  return `https://dashboard.render.com/web/${id}/logs`;
}

function resolveTarget(def) {
  const explicitUrl = trim(import.meta.env[def.urlEnv]);
  const serviceId = trim(import.meta.env[def.serviceIdEnv]);
  const url = explicitUrl || renderServiceLogsUrl(serviceId);
  if (!url) return null;
  return {
    id: def.id,
    label: def.label,
    serviceName: def.serviceName,
    serviceId: serviceId || null,
    url,
  };
}

/** Configured log destinations (empty when env vars unset). */
export function getRenderLogTargets() {
  return RENDER_LOG_TARGET_DEFS.map(resolveTarget).filter(Boolean);
}

export function getRenderLogTarget(targetId) {
  const def = RENDER_LOG_TARGET_DEFS.find((d) => d.id === targetId);
  return def ? resolveTarget(def) : null;
}

export function openRenderLogs(url) {
  const href = trim(url);
  if (!href) return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
