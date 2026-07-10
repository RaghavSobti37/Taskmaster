/** Prefix React Query keys with active tenant id when available. */
export function tenantQueryKey(tenantId, ...parts) {
  if (!tenantId) return parts;
  return [String(tenantId), ...parts];
}

/** Prefix React Query keys with org slug for cache isolation. */
export function orgQueryKey(orgSlug, ...parts) {
  if (!orgSlug) return parts;
  return ['org', String(orgSlug), ...parts];
}
