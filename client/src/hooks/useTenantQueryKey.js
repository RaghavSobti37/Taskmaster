import useActiveTenant from './useActiveTenant';
import { tenantQueryKey } from '../lib/tenantQuery';

/** React Query key prefix scoped to active tenant (org switch cache isolation). */
export default function useTenantQueryKey(...parts) {
  const { tenantIdStr } = useActiveTenant();
  return tenantQueryKey(tenantIdStr, ...parts);
}
