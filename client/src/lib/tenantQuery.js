/** Prefix React Query keys with active tenant id when available. */
export function tenantQueryKey(tenantId, ...parts) {
  if (!tenantId) return parts;
  return [String(tenantId), ...parts];
}
