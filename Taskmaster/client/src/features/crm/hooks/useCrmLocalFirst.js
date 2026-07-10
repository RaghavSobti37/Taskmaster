/** Phase 8a — CRM local-first rollout gate (Postgres tier 2–3 required). */
export const CRM_LOCAL_FIRST_ENABLED = import.meta.env.VITE_LOCAL_FIRST_CRM === 'true';

export function isCrmLocalFirstReady() {
  return CRM_LOCAL_FIRST_ENABLED;
}
