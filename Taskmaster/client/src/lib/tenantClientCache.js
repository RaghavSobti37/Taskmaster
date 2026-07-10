import { purgeLegacyUnscopedStorage } from './tenantSession';

/** Hard reset client caches on org switch — call before full page reload. */
export function prepareOrgSwitchCleanup(queryClient) {
  purgeLegacyUnscopedStorage();
  if (queryClient) {
    queryClient.clear();
  }
}

export async function purgeLocalFirstData() {
  if (import.meta.env.VITE_LOCAL_FIRST !== 'true') return;
  try {
    const { localQuery } = await import('@coreknot/local-database');
    await localQuery('DELETE FROM tasks');
    await localQuery('DELETE FROM projects');
    await localQuery('DELETE FROM workspaces');
  } catch {
    /* local DB optional */
  }
}

export async function onOrgSwitch(queryClient) {
  prepareOrgSwitchCleanup(queryClient);
  await purgeLocalFirstData();
}
