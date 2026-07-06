const ACTIVE_TENANT_SESSION_KEY = 'coreknot:activeTenantId';

const LEGACY_UNSCOPED_KEYS = [
  'crm-leads-filters',
  'crm-followups-filters',
  'finance-filters',
  'datahub-filters',
  'todo-filters',
  'schedule-filters',
  'projects-filters',
  'inbox-filters',
  'coreknot_note_drafts_v1',
  'tsc_custom_resend_from_emails',
];

export function getActiveTenantIdFromSession() {
  try {
    return sessionStorage.getItem(ACTIVE_TENANT_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function setActiveTenantIdInSession(tenantId) {
  try {
    if (tenantId) {
      sessionStorage.setItem(ACTIVE_TENANT_SESSION_KEY, String(tenantId));
    } else {
      sessionStorage.removeItem(ACTIVE_TENANT_SESSION_KEY);
    }
  } catch {
    /* private mode */
  }
}

export function scopedStorageKey(key, tenantId = getActiveTenantIdFromSession()) {
  if (!tenantId) return key;
  return `coreknot:${tenantId}:${key}`;
}

/** Drop pre-isolation localStorage keys after org switch. */
export function purgeLegacyUnscopedStorage() {
  try {
    LEGACY_UNSCOPED_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}
