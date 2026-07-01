/**
 * Render Dashboard log deep links (stdout / Pino → Render log store).
 * Set service IDs or full log URLs via VITE_* in Vercel / local client/.env.
 */

const trim = (value) => String(value || '').trim();

/** ponytail: public Render srv- IDs — env overrides for forks / renames */
export const RENDER_SERVICE_ID_DEFAULTS = {
  production: 'srv-d37a5m1r0fns739brt40',
  stagingApi: 'srv-d8vm9flaeets73d7l6r0',
  stagingNest: 'srv-d8vm9gbsq97s738h8plg',
};

export const RENDER_LOG_TARGET_DEFS = [
  {
    id: 'production-api',
    label: 'Production API',
    serviceName: 'Taskmaster',
    environment: 'production',
    serviceIdEnv: 'VITE_RENDER_SERVICE_ID_PRODUCTION',
    urlEnv: 'VITE_RENDER_LOGS_PRODUCTION_URL',
  },
  {
    id: 'staging-api',
    label: 'Staging API',
    serviceName: 'coreknot-api-staging',
    environment: 'staging',
    serviceIdEnv: 'VITE_RENDER_SERVICE_ID_STAGING_API',
    urlEnv: 'VITE_RENDER_LOGS_STAGING_API_URL',
  },
  {
    id: 'staging-nest',
    label: 'Nest Staging',
    serviceName: 'coreknot-nest-staging',
    environment: 'staging',
    serviceIdEnv: 'VITE_RENDER_SERVICE_ID_STAGING_NEST',
    urlEnv: 'VITE_RENDER_LOGS_STAGING_NEST_URL',
  },
];

export function renderServiceLogsUrl(serviceId) {
  const id = trim(serviceId);
  if (!id) return null;
  return `https://dashboard.render.com/web/${id}/logs`;
}

const DEFAULT_SERVICE_ID_BY_TARGET = {
  'production-api': RENDER_SERVICE_ID_DEFAULTS.production,
  'staging-api': RENDER_SERVICE_ID_DEFAULTS.stagingApi,
  'staging-nest': RENDER_SERVICE_ID_DEFAULTS.stagingNest,
};

function resolveTarget(def) {
  const explicitUrl = trim(import.meta.env[def.urlEnv]);
  const serviceId = trim(import.meta.env[def.serviceIdEnv])
    || DEFAULT_SERVICE_ID_BY_TARGET[def.id]
    || '';
  const url = explicitUrl || renderServiceLogsUrl(serviceId);
  if (!url) return null;
  return {
    id: def.id,
    label: def.label,
    serviceName: def.serviceName,
    environment: def.environment || 'staging',
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
