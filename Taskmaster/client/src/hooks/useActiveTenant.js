import { useAuth } from '../contexts/AuthContext';

/** Active Mongo tenant id for the current session (org switcher / JWT). */
export function resolveActiveTenantId(user) {
  if (!user) return null;
  return user.activeTenantId || user.tenantId || null;
}

export default function useActiveTenant() {
  const { user } = useAuth();
  const tenantId = resolveActiveTenantId(user);
  return {
    tenantId,
    tenantIdStr: tenantId ? String(tenantId) : null,
  };
}
